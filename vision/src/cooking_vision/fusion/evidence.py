from __future__ import annotations

from dataclasses import dataclass,field

from cooking_vision.contracts import VisionCandidate


@dataclass
class FusedIngredientCandidate:
    canonical_ingredient_key:str|None
    confidence:float
    evidence:list[str]=field(default_factory=list)
    conflicts:list[str]=field(default_factory=list)
    requires_confirmation:bool=True


def merge_candidate_evidence(
    visual:VisionCandidate,
    *,
    ocr_label:str|None=None,
    barcode_key:str|None=None,
    measured_weight_g:float|None=None,
)->FusedIngredientCandidate:
    """Conservative placeholder: conflicts never become automatic inventory updates."""
    keys=[key for key in [visual.canonical_ingredient_key,barcode_key] if key]
    conflicts:list[str]=[]
    if len(set(keys))>1:
        conflicts.append("视觉类别与条码映射不一致")
    evidence=["visual_detection"]
    if ocr_label:
        evidence.append("package_ocr")
    if barcode_key:
        evidence.append("barcode")
    if measured_weight_g is not None:
        evidence.append("weight")
    resolved=keys[0] if keys and not conflicts else None
    confidence=visual.confidence if resolved else min(visual.confidence,.49)
    return FusedIngredientCandidate(
        canonical_ingredient_key=resolved,
        confidence=confidence,
        evidence=evidence,
        conflicts=conflicts,
        requires_confirmation=True,
    )
