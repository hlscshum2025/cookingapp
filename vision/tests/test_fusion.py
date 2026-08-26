from cooking_vision.contracts import BoundingBox,VisionCandidate
from cooking_vision.fusion.evidence import merge_candidate_evidence


def test_conflicting_barcode_stays_unknown():
    visual=VisionCandidate(
        source_image="bag.jpg",scene="bagged",label="tomato",confidence=.82,
        bbox=BoundingBox(0,0,10,10),model_name="test",model_version="0",canonical_ingredient_key="tomato",
    )
    fused=merge_candidate_evidence(visual,barcode_key="apple")
    assert fused.canonical_ingredient_key is None
    assert fused.requires_confirmation is True
    assert fused.conflicts
