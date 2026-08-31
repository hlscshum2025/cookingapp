from __future__ import annotations

from pathlib import Path
from time import perf_counter
from typing import Sequence

from cooking_vision.contracts import portable_source
from cooking_vision.note.contracts import (
    NoteOcrPage,
    RecipeScreenshotDraft,
    ScreenshotCropMode,
)
from cooking_vision.note.parser import merge_page_lines, parse_recipe_text
from cooking_vision.note.preprocess import (
    preprocess_note_screenshot,
    save_note_stages,
)
from cooking_vision.receipt.paddle_backend import run_paddle_ocr
from cooking_vision.receipt.parser import merge_ocr_rows


def build_xiaohongshu_recipe_draft(
    image_paths: Sequence[str | Path],
    *,
    language: str = "ch",
    device: str = "cpu",
    min_confidence: float = 0.35,
    max_side: int = 2200,
    crop_mode: ScreenshotCropMode = "auto",
    right_ratio: float = 0.42,
    stages_dir: str | Path | None = None,
) -> RecipeScreenshotDraft:
    if not image_paths:
        raise ValueError("At least one screenshot is required")

    started = perf_counter()
    pages: list[NoteOcrPage] = []
    page_texts: list[list[str]] = []
    warnings: list[str] = []
    model_version = "unknown"

    for index, image_path in enumerate(image_paths, start=1):
        page_started = perf_counter()
        processed = preprocess_note_screenshot(
            image_path,
            max_side=max_side,
            crop_mode=crop_mode,
            right_ratio=right_ratio,
        )
        if stages_dir is not None:
            save_note_stages(
                processed,
                Path(stages_dir) / f"page-{index:02d}",
            )

        detected_lines, raw_outputs, model_version = run_paddle_ocr(
            processed.ocr_image,
            language=language,
            device=device,
            min_confidence=min_confidence,
        )
        rows = merge_ocr_rows(detected_lines)
        page_texts.append([row.text for row in rows])
        if not rows:
            warnings.append(
                f"第 {index} 张截图没有得到超过置信度阈值的文字。"
            )

        height, width = processed.normalized.shape[:2]
        pages.append(
            NoteOcrPage(
                source_image=portable_source(image_path),
                input_index=index,
                crop_mode=processed.crop_mode,
                crop_bbox=processed.crop_bbox,
                image_width=width,
                image_height=height,
                lines=rows,
                raw_result={
                    "pages": raw_outputs,
                    "language": language,
                    "device": device,
                    "detected_line_count": len(detected_lines),
                    "merged_row_count": len(rows),
                },
                latency_ms=round((perf_counter() - page_started) * 1000),
            )
        )

    merged_text_lines, removed_per_page = merge_page_lines(page_texts)
    parsed = parse_recipe_text(merged_text_lines)

    if not merged_text_lines:
        warnings.append("所有截图均未识别出可用文字。")
    if parsed.title is None:
        warnings.append("没有可靠识别出菜谱标题，请人工补充。")
    if not parsed.ingredients:
        warnings.append("没有找到“食材/材料/用料”区块，请人工检查。")
    if not parsed.steps:
        warnings.append("没有找到“做法/步骤”区块，请人工检查。")

    return RecipeScreenshotDraft(
        source_images=[portable_source(path) for path in image_paths],
        provider="paddleocr",
        model_version=model_version,
        pages=pages,
        merged_text_lines=merged_text_lines,
        title=parsed.title,
        author=parsed.author,
        description=parsed.description,
        ingredients=parsed.ingredients,
        steps=parsed.steps,
        warnings=warnings,
        raw_result={
            "language": language,
            "device": device,
            "requested_crop_mode": crop_mode,
            "overlap_lines_removed_per_page": removed_per_page,
        },
        latency_ms=round((perf_counter() - started) * 1000),
    )
