from __future__ import annotations

import csv
import traceback
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import Any, Callable

from cooking_vision.diagnostics import probe_import
from cooking_vision.json_io import write_json


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
ProgressSink = Callable[[str], None]


@dataclass(frozen=True)
class BatchRunResult:
    rows: list[dict[str, Any]]
    summary_path: Path
    batch_log_path: Path
    error_log_path: Path
    fatal_error: str | None = None

    @property
    def total(self) -> int:
        return len(self.rows)

    @property
    def succeeded(self) -> int:
        return sum(row["status"] == "ok" for row in self.rows)

    @property
    def failed(self) -> int:
        return sum(row["status"] == "error" for row in self.rows)


class _BatchReporter:
    def __init__(self, destination: Path, progress: ProgressSink | None = None) -> None:
        logs_dir = destination / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        self.batch_log_path = logs_dir / "batch.log"
        self.error_log_path = logs_dir / "errors.log"
        self.batch_log_path.write_text("", encoding="utf-8")
        self.error_log_path.write_text("", encoding="utf-8")
        self._progress = progress or (lambda message: print(message, flush=True))
        self.error_count = 0

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(UTC).isoformat(timespec="seconds")

    @staticmethod
    def _append(path: Path, text: str) -> None:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(text)

    def emit(self, message: str) -> None:
        self._progress(message)
        self._append(self.batch_log_path, f"{self._timestamp()} {message}\n")

    def error(self, image: str, error: BaseException) -> str:
        self.error_count += 1
        short_error = f"{type(error).__name__}: {error}"
        trace = "".join(traceback.format_exception(type(error), error, error.__traceback__))
        self._append(
            self.error_log_path,
            f"{self._timestamp()} image={image}\n{short_error}\n{trace.rstrip()}\n\n",
        )
        self.emit(f"失败：{image} — {short_error}")
        return short_error

    def finish_error_log(self) -> None:
        if self.error_count == 0:
            self.error_log_path.write_text("本次运行没有失败记录。\n", encoding="utf-8")


def find_receipt_images(input_dir: str | Path, recursive: bool = True) -> list[Path]:
    directory = Path(input_dir)
    if not directory.is_dir():
        raise NotADirectoryError(f"Receipt input directory does not exist: {directory}")
    candidates = directory.rglob("*") if recursive else directory.glob("*")
    return sorted(
        path
        for path in candidates
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )


def _write_summary(rows: list[dict[str, Any]], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "image",
        "status",
        "store_name",
        "purchase_date",
        "purchase_time",
        "total_amount",
        "ocr_rows",
        "item_candidates",
        "document_found",
        "latency_ms",
        "result_json",
        "stages_dir",
        "error",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return path


def _empty_result(
    source: Path,
    destination: Path,
    reporter: _BatchReporter,
    error: BaseException,
) -> BatchRunResult:
    short_error = reporter.error(str(source), error)
    summary_path = _write_summary([], destination / "summary.csv")
    reporter.emit("批处理未开始。")
    reporter.emit(f"汇总文件：{summary_path}")
    reporter.emit(f"运行日志：{reporter.batch_log_path}")
    reporter.emit(f"错误日志：{reporter.error_log_path}")
    return BatchRunResult(
        rows=[],
        summary_path=summary_path,
        batch_log_path=reporter.batch_log_path,
        error_log_path=reporter.error_log_path,
        fatal_error=short_error,
    )


def run_receipt_batch(
    input_dir: str | Path,
    output_dir: str | Path,
    *,
    language: str = "german",
    device: str = "cpu",
    min_confidence: float = 0.35,
    max_side: int = 2200,
    save_stages: bool = False,
    recursive: bool = True,
    progress: ProgressSink | None = None,
) -> BatchRunResult:
    source = Path(input_dir).expanduser().resolve()
    destination = Path(output_dir).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    reporter = _BatchReporter(destination, progress=progress)

    reporter.emit("开始小票 OCR 批处理")
    reporter.emit(f"输入目录：{source}")
    reporter.emit(f"输出目录：{destination}")
    reporter.emit(
        f"配置：language={language}, device={device}, "
        f"min_confidence={min_confidence}, max_side={max_side}"
    )

    try:
        images = find_receipt_images(source, recursive=recursive)
    except Exception as error:
        return _empty_result(source, destination, reporter, error)

    reporter.emit(f"找到支持的图片：{len(images)} 张")
    if not images:
        suffixes = ", ".join(sorted(IMAGE_SUFFIXES))
        error = FileNotFoundError(
            f"No supported receipt images found in {source}. Supported suffixes: {suffixes}"
        )
        return _empty_result(source, destination, reporter, error)

    reporter.emit("开始检查 OCR 运行库。")
    for module, label in (
        ("cv2", "OpenCV"),
        ("paddle", "PaddlePaddle"),
        ("paddleocr", "PaddleOCR"),
    ):
        reporter.emit(f"运行库自检：正在导入 {label} ({module}) ...")
        probe = probe_import(module)
        if not probe.ok:
            error = RuntimeError(
                f"{label} import failed in a child process; "
                f"exit_code={probe.return_code}; details={probe.details}"
            )
            return _empty_result(source, destination, reporter, error)
        reporter.emit(f"运行库自检通过：{label} {probe.version}")

    reporter.emit("提示：处理第一张图片时会初始化或下载 PaddleOCR 模型，可能需要等待。")
    reporter.emit("正在加载 CookingApp OCR 管线 ...")
    try:
        from cooking_vision.receipt.pipeline import build_receipt_draft
    except (Exception, SystemExit) as error:
        return _empty_result(source, destination, reporter, error)
    reporter.emit("CookingApp OCR 管线加载完成。")

    rows: list[dict[str, Any]] = []

    for index, image_path in enumerate(images, start=1):
        relative = image_path.relative_to(source)
        relative_text = relative.as_posix()
        json_path = destination / "json" / relative.with_suffix(".json")
        stages_dir = (
            destination / "stages" / relative.parent / relative.stem
            if save_stages
            else None
        )
        reporter.emit(f"[{index}/{len(images)}] 正在处理：{relative_text}")
        started = perf_counter()

        try:
            draft = build_receipt_draft(
                image_path,
                language=language,
                device=device,
                min_confidence=min_confidence,
                max_side=max_side,
                stages_dir=stages_dir,
            )
            write_json(draft.to_dict(), json_path)
            elapsed_ms = round((perf_counter() - started) * 1000)
            rows.append(
                {
                    "image": relative_text,
                    "status": "ok",
                    "store_name": draft.metadata.store_name or "",
                    "purchase_date": draft.metadata.purchase_date or "",
                    "purchase_time": draft.metadata.purchase_time or "",
                    "total_amount": (
                        draft.metadata.total_amount
                        if draft.metadata.total_amount is not None
                        else ""
                    ),
                    "ocr_rows": len(draft.lines),
                    "item_candidates": len(draft.items),
                    "document_found": draft.raw_result.get("document_found", False),
                    "latency_ms": draft.latency_ms or elapsed_ms,
                    "result_json": str(json_path),
                    "stages_dir": str(stages_dir) if stages_dir is not None else "",
                    "error": "",
                }
            )
            reporter.emit(
                f"[{index}/{len(images)}] 成功：OCR 文本行 {len(draft.lines)}，"
                f"商品候选 {len(draft.items)}，耗时 {elapsed_ms} ms"
            )
            reporter.emit(f"结果 JSON：{json_path}")
        except Exception as error:
            elapsed_ms = round((perf_counter() - started) * 1000)
            short_error = reporter.error(relative_text, error)
            rows.append(
                {
                    "image": relative_text,
                    "status": "error",
                    "store_name": "",
                    "purchase_date": "",
                    "purchase_time": "",
                    "total_amount": "",
                    "ocr_rows": 0,
                    "item_candidates": 0,
                    "document_found": "",
                    "latency_ms": elapsed_ms,
                    "result_json": "",
                    "stages_dir": str(stages_dir) if stages_dir is not None else "",
                    "error": short_error,
                }
            )

    summary_path = _write_summary(rows, destination / "summary.csv")
    result = BatchRunResult(
        rows=rows,
        summary_path=summary_path,
        batch_log_path=reporter.batch_log_path,
        error_log_path=reporter.error_log_path,
    )
    reporter.finish_error_log()
    reporter.emit(
        f"批处理完成：共 {result.total} 张，成功 {result.succeeded} 张，"
        f"失败 {result.failed} 张。"
    )
    reporter.emit(f"汇总文件：{result.summary_path}")
    reporter.emit(f"结果目录：{destination / 'json'}")
    if save_stages:
        reporter.emit(f"预处理图目录：{destination / 'stages'}")
    reporter.emit(f"运行日志：{result.batch_log_path}")
    reporter.emit(f"错误日志：{result.error_log_path}")
    return result
