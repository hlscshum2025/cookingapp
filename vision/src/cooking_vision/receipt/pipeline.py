from __future__ import annotations

from pathlib import Path
from time import perf_counter

from cooking_vision.contracts import ReceiptOcrDraft, portable_source
from cooking_vision.contracts import BoundingBox,OcrTextLine
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


def _offset_line(line:OcrTextLine,y_offset:int)->OcrTextLine:
    return OcrTextLine(
        text=line.text,
        confidence=line.confidence,
        bbox=BoundingBox(
            line.bbox.x_min,
            line.bbox.y_min+y_offset,
            line.bbox.x_max,
            line.bbox.y_max+y_offset,
        ),
    )


def _vertical_tiles(image,max_height:int,overlap:int=160):
    height=image.shape[0]
    if height<=max_height:
        return [(0,image)]
    usable=max(1,max_height-overlap)
    tile_count=max(2,(height-overlap+usable-1)//usable)
    tile_height=(height+(tile_count-1)*overlap+tile_count-1)//tile_count
    step=max(1,tile_height-overlap)
    starts=[min(index*step,height-tile_height) for index in range(tile_count)]
    return [(top,image[top:top+tile_height]) for top in starts]


def _run_tiled_ocr(image,*,language:str,device:str,min_confidence:float,max_height:int):
    lines=[]
    raw=[]
    version="unknown"
    tiles=_vertical_tiles(image,max_height)
    for index,(top,tile) in enumerate(tiles,start=1):
        tile_lines,tile_raw,version=run_paddle_ocr(
            tile,
            language=language,
            device=device,
            min_confidence=min_confidence,
        )
        lines=_merge_passes(lines,[_offset_line(line,top) for line in tile_lines])
        raw.append({"tile_index":index,"y_offset":top,"height":tile.shape[0],"outputs":tile_raw})
    return lines,raw,version,len(tiles)


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
    detected_lines,raw_outputs,version,tile_count=_run_tiled_ocr(
        processed.normalized,
        language=language,
        device=device,
        min_confidence=min_confidence,
        max_height=max_side,
    )
    fallback_used=False
    # A cropped/partial receipt legitimately has no four-corner contour.  In
    # that case the color photo can also have weak paper/background contrast.
    # Retry only clearly poor results with CLAHE-enhanced grayscale and keep
    # the better union.  The Paddle model remains cached; this is an extra
    # inference pass, not another model load.
    if len(detected_lines)<4:
        fallback_lines,fallback_outputs,_,fallback_tile_count=_run_tiled_ocr(
            processed.enhanced_ocr_image(),
            language=language,
            device=device,
            min_confidence=min_confidence,
            max_height=max_side,
        )
        detected_lines=_merge_passes(detected_lines,fallback_lines)
        raw_outputs.append({"fallback":"clahe-grayscale","tiles":fallback_outputs})
        tile_count=max(tile_count,fallback_tile_count)
        fallback_used=True
    lines=merge_ocr_rows(detected_lines)
    warnings:list[str]=[]
    if not processed.document_found:
        warnings.append("没有稳定检测到小票四边形；本次使用缩放后的整张图片。")
    if fallback_used:
        warnings.append("首轮文字过少，已自动使用增强灰度图再次识别。")
    if tile_count>1:
        warnings.append(f"图片较长，已保持文字宽度并分成 {tile_count} 个重叠区域识别。")
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
            "tile_count":tile_count,
        },
        latency_ms=round((perf_counter()-started)*1000),
    )
