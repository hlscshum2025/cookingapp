from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np

from cooking_vision.contracts import BoundingBox, OcrTextLine


def _plain(value:Any)->Any:
    if hasattr(value,"tolist"):
        return value.tolist()
    if isinstance(value,dict):
        return {str(key):_plain(item) for key,item in value.items()}
    if isinstance(value,(list,tuple)):
        return [_plain(item) for item in value]
    if isinstance(value,(str,int,float,bool)) or value is None:
        return value
    return str(value)


def _box(raw_box:Any,raw_polygon:Any)->BoundingBox:
    if raw_box is not None and len(raw_box)>=4:
        return BoundingBox(float(raw_box[0]),float(raw_box[1]),float(raw_box[2]),float(raw_box[3]))
    points=_plain(raw_polygon) or [[0,0],[0,0],[0,0],[0,0]]
    xs=[float(point[0]) for point in points]
    ys=[float(point[1]) for point in points]
    return BoundingBox(min(xs),min(ys),max(xs),max(ys))


def _ensure_three_channel_image(image:Any)->np.ndarray:
    """PaddleX text detection expects a contiguous H x W x 3 image array."""
    array=np.asarray(image)
    if array.ndim==2:
        array=np.repeat(array[...,np.newaxis],3,axis=2)
    elif array.ndim==3 and array.shape[2]==1:
        array=np.repeat(array,3,axis=2)
    elif array.ndim==3 and array.shape[2]==4:
        array=array[:,:,:3]
    elif array.ndim!=3 or array.shape[2]!=3:
        raise ValueError(
            f"PaddleOCR expects an H x W x 3 image; received shape {array.shape}"
        )
    return np.ascontiguousarray(array)


@lru_cache(maxsize=4)
def _load_pipeline(language:str,device:str)->tuple[Any,str]:
    try:
        import paddleocr
        from paddleocr import PaddleOCR
    except ImportError as error:
        raise RuntimeError("PaddleOCR environment is missing. Install requirements/ocr-cpu.txt first.") from error

    pipeline=PaddleOCR(
        lang=language,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device=device,
    )
    return pipeline,getattr(paddleocr,"__version__","unknown")


def run_paddle_ocr(image:Any,language:str="german",device:str="cpu",min_confidence:float=.35)->tuple[list[OcrTextLine],list[dict[str,Any]],str]:
    pipeline,version=_load_pipeline(language,device)
    prepared_image=_ensure_three_channel_image(image)
    outputs=list(pipeline.predict(prepared_image))
    lines:list[OcrTextLine]=[]
    raw_outputs:list[dict[str,Any]]=[]
    for output in outputs:
        payload=getattr(output,"json",{})
        if callable(payload):
            payload=payload()
        payload=_plain(payload)
        if not isinstance(payload,dict):
            payload={"result":payload}
        raw_outputs.append(payload)
        result=payload.get("res",payload)
        texts=result.get("rec_texts",[]) if isinstance(result,dict) else []
        scores=result.get("rec_scores",[]) if isinstance(result,dict) else []
        boxes=result.get("rec_boxes",[]) if isinstance(result,dict) else []
        polygons=result.get("rec_polys",[]) if isinstance(result,dict) else []
        for index,text in enumerate(texts):
            confidence=float(scores[index]) if index<len(scores) else 0.0
            if not str(text).strip() or confidence<min_confidence:
                continue
            raw_box=boxes[index] if index<len(boxes) else None
            raw_polygon=polygons[index] if index<len(polygons) else None
            lines.append(OcrTextLine(text=str(text),confidence=confidence,bbox=_box(raw_box,raw_polygon)))
    lines.sort(key=lambda line:(line.bbox.y_min,line.bbox.x_min))
    return lines,raw_outputs,version
