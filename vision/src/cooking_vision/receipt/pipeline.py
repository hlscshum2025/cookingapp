from __future__ import annotations

from pathlib import Path
from time import perf_counter

from cooking_vision.contracts import ReceiptOcrDraft, portable_source
from cooking_vision.receipt.paddle_backend import run_paddle_ocr
from cooking_vision.receipt.parser import extract_item_candidates,extract_metadata,merge_ocr_rows
from cooking_vision.receipt.preprocess import preprocess_receipt, save_preprocess_stages


def _line_key(line)->tuple[str,int,int]:
    text="".join(line.text.lower().split())
    return text,round(line.bbox.y_min/8),round(line.bbox.x_min/8)


def _merge_passes(primary, fallback):
    """Combine OCR passes without duplicating the same positioned text."""
    selected={_line_key(line):line for line in primary}
    for line in fallback:
        key=_line_key(line)
        existing=selected.get(key)
        if existing is None or line.confidence>existing.confidence:
            selected[key]=line
    return sorted(selected.values(),key=lambda line:(line.bbox.y_min,line.bbox.x_min))


def build_receipt_draft(
    image_path:str|Path,
    *,
    language:str="german",
    device:str="cpu",
    min_confidence:float=.35,
    max_side:int=2200,
    stages_dir:str|Path|None=None,
)->ReceiptOcrDraft:
    started=perf_counter()
    processed=preprocess_receipt(image_path,max_side=max_side)
    if stages_dir is not None:
        save_preprocess_stages(processed,stages_dir)
    detected_lines,raw_outputs,version=run_paddle_ocr(
        processed.normalized,
        language=language,
        device=device,
        min_confidence=min_confidence,
    )
    fallback_used=False
    # A cropped/partial receipt legitimately has no four-corner contour.  In
    # that case the color photo can also have weak paper/background contrast.
    # Retry only clearly poor results with CLAHE-enhanced grayscale and keep
    # the better union.  The Paddle model remains cached; this is an extra
    # inference pass, not another model load.
    if len(detected_lines)<4:
        fallback_lines,fallback_outputs,_=run_paddle_ocr(
            processed.enhanced_ocr_image(),
            language=language,
            device=device,
            min_confidence=min_confidence,
        )
        detected_lines=_merge_passes(detected_lines,fallback_lines)
        raw_outputs.append({"fallback":"clahe-grayscale","pages":fallback_outputs})
        fallback_used=True
    lines=merge_ocr_rows(detected_lines)
    warnings:list[str]=[]
    if not processed.document_found:
        warnings.append("没有稳定检测到小票四边形；本次使用缩放后的整张图片。")
    if fallback_used:
        warnings.append("首轮文字过少，已自动使用增强灰度图再次识别。")
    if not lines:
        warnings.append("OCR 没有得到超过置信度阈值的文本行。")
    items=extract_item_candidates(lines)
    metadata=extract_metadata(lines)
    if lines and not items:
        warnings.append("识别到了文字，但还没有解析出带价格的商品候选行。")
    return ReceiptOcrDraft(
        source_image=portable_source(image_path),
        provider="paddleocr",
        model_version=version,
        lines=lines,
        items=items,
        metadata=metadata,
        warnings=warnings,
        raw_result={
            "pages":raw_outputs,
            "language":language,
            "device":device,
            "document_found":processed.document_found,
            "detected_line_count":len(detected_lines),
            "merged_row_count":len(lines),
            "fallback_used":fallback_used,
        },
        latency_ms=round((perf_counter()-started)*1000),
    )
