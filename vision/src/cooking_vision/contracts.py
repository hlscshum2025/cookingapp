from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal


def utc_now_iso()->str:
    return datetime.now(UTC).isoformat()


@dataclass(frozen=True)
class BoundingBox:
    x_min:float
    y_min:float
    x_max:float
    y_max:float

    def __post_init__(self)->None:
        if self.x_max<self.x_min or self.y_max<self.y_min:
            raise ValueError("BoundingBox maximum coordinates must be >= minimum coordinates")


@dataclass(frozen=True)
class OcrTextLine:
    text:str
    confidence:float
    bbox:BoundingBox


@dataclass(frozen=True)
class ReceiptItemCandidate:
    raw_text:str
    confidence:float
    bbox:BoundingBox|None=None
    product_name:str|None=None
    quantity:float|None=None
    quantity_unit:str|None=None
    package_amount:float|None=None
    package_unit:str|None=None
    unit_price:float|None=None
    line_total:float|None=None
    currency:str="EUR"
    verification_status:Literal["unverified","user_verified","rejected"]="unverified"


@dataclass(frozen=True)
class ReceiptMetadataCandidate:
    store_name:str|None=None
    purchase_date:str|None=None
    purchase_time:str|None=None
    currency:str="EUR"
    total_amount:float|None=None


@dataclass
class ReceiptOcrDraft:
    source_image:str
    provider:str
    model_version:str
    preprocess_version:str="opencv-baseline-v1"
    schema_version:str="receipt-ocr-draft-v1"
    created_at:str=field(default_factory=utc_now_iso)
    lines:list[OcrTextLine]=field(default_factory=list)
    items:list[ReceiptItemCandidate]=field(default_factory=list)
    metadata:ReceiptMetadataCandidate=field(default_factory=ReceiptMetadataCandidate)
    warnings:list[str]=field(default_factory=list)
    raw_result:dict[str,Any]=field(default_factory=dict)
    latency_ms:int|None=None
    confirmed:bool=False

    def to_dict(self)->dict[str,Any]:
        return asdict(self)


SceneType=Literal["fridge","tabletop","bagged","unknown"]


@dataclass
class VisionCandidate:
    source_image:str
    scene:SceneType
    label:str
    confidence:float
    bbox:BoundingBox
    model_name:str
    model_version:str
    schema_version:str="vision-candidate-v1"
    canonical_ingredient_key:str|None=None
    mask_polygon:list[list[float]]|None=None
    quantity_min:int=1
    quantity_max:int=1
    evidence:list[str]=field(default_factory=lambda:["visual_detection"])
    verification_status:Literal["unverified","user_verified","rejected"]="unverified"

    def to_dict(self)->dict[str,Any]:
        return asdict(self)


def portable_source(path:str|Path)->str:
    """Keep only a normalized local path reference; never embed image bytes in JSON."""
    return Path(path).expanduser().resolve().as_posix()
