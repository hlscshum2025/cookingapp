from __future__ import annotations

from pathlib import Path

from cooking_vision.contracts import ReceiptOcrDraft, portable_source
from cooking_vision.receipt.paddle_backend import run_paddle_ocr
from cooking_vision.receipt.parser import extract_item_candidates
from cooking_vision.receipt.preprocess import preprocess_receipt, save_preprocess_stages


def build_receipt_draft(
    image_path:str|Path,
    *,
    language:str="german",
    device:str="cpu",
    min_confidence:float=.35,
    max_side:int=2200,
    stages_dir:str|Path|None=None,
)->ReceiptOcrDraft:
    processed=preprocess_receipt(image_path,max_side=max_side)
    if stages_dir is not None:
        save_preprocess_stages(processed,stages_dir)
    lines,raw_outputs,version=run_paddle_ocr(
        processed.grayscale,
        language=language,
        device=device,
        min_confidence=min_confidence,
    )
    warnings:list[str]=[]
    if not processed.document_found:
        warnings.append("没有稳定检测到小票四边形；本次使用缩放后的整张图片。")
    if not lines:
        warnings.append("OCR 没有得到超过置信度阈值的文本行。")
    items=extract_item_candidates(lines)
    if lines and not items:
        warnings.append("识别到了文字，但还没有解析出带价格的商品候选行。")
    return ReceiptOcrDraft(
        source_image=portable_source(image_path),
        provider="paddleocr",
        model_version=version,
        lines=lines,
        items=items,
        warnings=warnings,
        raw_result={"pages":raw_outputs,"language":language,"device":device},
    )
