from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from time import perf_counter
from typing import Any, Callable, Sequence

from cooking_vision.contracts import ReceiptOcrDraft, utc_now_iso


@dataclass
class ReceiptOcrBatchDraft:
    """Review-only result for one long receipt photographed in page order."""

    source_images: list[str]
    pages: list[ReceiptOcrDraft]
    schema_version: str = "receipt-ocr-batch-v1"
    created_at: str = field(default_factory=utc_now_iso)
    warnings: list[str] = field(default_factory=list)
    overlap_items_removed: int = 0
    latency_ms: int | None = None
    confirmed: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _overlap_size(left: list[str], right: list[str], *, limit: int = 8) -> int:
    maximum = min(len(left), len(right), limit)
    for size in range(maximum, 0, -1):
        if left[-size:] == right[:size]:
            return size
    return 0


def build_receipt_batch_draft(
    image_paths: Sequence[str | Path],
    *,
    language: str = "german",
    device: str = "cpu",
    min_confidence: float = 0.35,
    max_side: int = 2200,
    stages_dir: str | Path | None = None,
    page_builder: Callable[..., ReceiptOcrDraft] | None = None,
) -> ReceiptOcrBatchDraft:
    if not image_paths:
        raise ValueError("At least one receipt image is required")
    if page_builder is None:
        from cooking_vision.receipt.pipeline import build_receipt_draft

        page_builder = build_receipt_draft

    started = perf_counter()
    pages: list[ReceiptOcrDraft] = []
    warnings: list[str] = []
    removed = 0
    previous_tail: list[str] = []

    for index, image_path in enumerate(image_paths, start=1):
        page_stages = Path(stages_dir) / f"page-{index:02d}" if stages_dir else None
        page = page_builder(
            image_path,
            language=language,
            device=device,
            min_confidence=min_confidence,
            max_side=max_side,
            stages_dir=page_stages,
        )
        current_names = [item.raw_text.strip() for item in page.items]
        overlap = _overlap_size(previous_tail, current_names)
        if overlap:
            page.items = page.items[overlap:]
            removed += overlap
        previous_tail = current_names[-8:]
        warnings.extend(f"第 {index} 张：{message}" for message in page.warnings)
        pages.append(page)

    if removed:
        warnings.append(f"相邻照片边界去除了 {removed} 条重复商品候选。")
    return ReceiptOcrBatchDraft(
        source_images=[str(path) for path in image_paths],
        pages=pages,
        warnings=warnings,
        overlap_items_removed=removed,
        latency_ms=round((perf_counter() - started) * 1000),
    )
