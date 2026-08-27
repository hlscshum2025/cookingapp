from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from cooking_vision.json_io import write_json
from cooking_vision.receipt.pipeline import build_receipt_draft


IMAGE_SUFFIXES={".jpg",".jpeg",".png",".bmp",".tif",".tiff",".webp"}


def find_receipt_images(input_dir:str|Path,recursive:bool=True)->list[Path]:
    directory=Path(input_dir)
    if not directory.is_dir():
        raise NotADirectoryError(f"Receipt input directory does not exist: {directory}")
    candidates=directory.rglob("*") if recursive else directory.glob("*")
    return sorted(path for path in candidates if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES)


def _write_summary(rows:list[dict[str,Any]],path:Path)->Path:
    path.parent.mkdir(parents=True,exist_ok=True)
    fields=[
        "image","status","store_name","purchase_date","purchase_time","total_amount",
        "ocr_rows","item_candidates","document_found","latency_ms","error",
    ]
    with path.open("w",encoding="utf-8-sig",newline="") as handle:
        writer=csv.DictWriter(handle,fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return path


def run_receipt_batch(
    input_dir:str|Path,
    output_dir:str|Path,
    *,
    language:str="german",
    device:str="cpu",
    min_confidence:float=.35,
    max_side:int=2200,
    save_stages:bool=False,
    recursive:bool=True,
)->tuple[list[dict[str,Any]],Path]:
    source=Path(input_dir)
    destination=Path(output_dir)
    rows:list[dict[str,Any]]=[]
    for image_path in find_receipt_images(source,recursive=recursive):
        relative=image_path.relative_to(source)
        json_path=destination/"json"/relative.with_suffix(".json")
        stages_dir=destination/"stages"/relative.parent/relative.stem if save_stages else None
        try:
            draft=build_receipt_draft(
                image_path,
                language=language,
                device=device,
                min_confidence=min_confidence,
                max_side=max_side,
                stages_dir=stages_dir,
            )
            write_json(draft.to_dict(),json_path)
            rows.append({
                "image":relative.as_posix(),
                "status":"ok",
                "store_name":draft.metadata.store_name or "",
                "purchase_date":draft.metadata.purchase_date or "",
                "purchase_time":draft.metadata.purchase_time or "",
                "total_amount":draft.metadata.total_amount if draft.metadata.total_amount is not None else "",
                "ocr_rows":len(draft.lines),
                "item_candidates":len(draft.items),
                "document_found":draft.raw_result.get("document_found",False),
                "latency_ms":draft.latency_ms or "",
                "error":"",
            })
        except Exception as error:
            rows.append({
                "image":relative.as_posix(),"status":"error","store_name":"","purchase_date":"",
                "purchase_time":"","total_amount":"","ocr_rows":0,"item_candidates":0,
                "document_found":"","latency_ms":"","error":f"{type(error).__name__}: {error}",
            })
    return rows,_write_summary(rows,destination/"summary.csv")
