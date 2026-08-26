from __future__ import annotations

from pathlib import Path
from typing import cast

from cooking_vision.contracts import BoundingBox, SceneType, VisionCandidate, portable_source
from cooking_vision.receipt.preprocess import read_image, write_image


DEFAULT_CLASSES=[
    "apple","banana","tomato","egg","milk carton","cucumber","onion","potato","bell pepper","packaged food",
]

CANONICAL_MAPPING={
    "apple":"apple","banana":"banana","tomato":"tomato","egg":"egg","milk carton":"milk",
    "cucumber":"cucumber","onion":"onion","potato":"potato","bell pepper":"bell-pepper",
}


def detect_food_candidates(
    image_path:str|Path,
    *,
    scene:SceneType="unknown",
    model_name:str="yolov8s-worldv2.pt",
    classes:list[str]|None=None,
    confidence:float=.20,
    image_size:int=640,
    device:str="cpu",
    annotated_path:str|Path|None=None,
)->list[VisionCandidate]:
    try:
        import ultralytics
        from ultralytics import YOLOWorld
    except ImportError as error:
        raise RuntimeError("Ultralytics environment is missing. Install requirements/vision-cpu.txt first.") from error

    prompts=classes or DEFAULT_CLASSES
    model=YOLOWorld(model_name)
    model.set_classes(prompts)
    image=read_image(image_path)
    predictions=model.predict(source=image,conf=confidence,imgsz=image_size,device=device,verbose=False)
    if not predictions:
        return []
    result=predictions[0]
    if annotated_path is not None:
        write_image(annotated_path,result.plot())
    boxes=result.boxes
    if boxes is None:
        return []
    coordinates=boxes.xyxy.cpu().tolist()
    scores=boxes.conf.cpu().tolist()
    class_ids=[int(value) for value in boxes.cls.cpu().tolist()]
    names=result.names
    candidates:list[VisionCandidate]=[]
    for coordinates_row,score,class_id in zip(coordinates,scores,class_ids,strict=True):
        label=str(names[class_id] if isinstance(names,dict) else names[class_id])
        candidates.append(VisionCandidate(
            source_image=portable_source(image_path),
            scene=cast(SceneType,scene),
            label=label,
            canonical_ingredient_key=CANONICAL_MAPPING.get(label),
            confidence=float(score),
            bbox=BoundingBox(*[float(value) for value in coordinates_row]),
            model_name=model_name,
            model_version=getattr(ultralytics,"__version__","unknown"),
        ))
    return candidates
