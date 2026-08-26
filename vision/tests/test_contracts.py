from cooking_vision.contracts import BoundingBox,ReceiptItemCandidate,ReceiptOcrDraft,VisionCandidate


def test_receipt_draft_is_review_only_and_json_ready():
    box=BoundingBox(1,2,30,40)
    draft=ReceiptOcrDraft(
        source_image="receipt.jpg",
        provider="test",
        model_version="0",
        items=[ReceiptItemCandidate(raw_text="BIO TOMATEN 2,49",product_name="BIO TOMATEN",line_total=2.49,confidence=.9,bbox=box)],
    )
    payload=draft.to_dict()
    assert payload["confirmed"] is False
    assert payload["items"][0]["verification_status"]=="unverified"
    assert payload["items"][0]["bbox"]["x_max"]==30


def test_vision_candidate_requires_confirmation():
    candidate=VisionCandidate(
        source_image="fridge.jpg",scene="fridge",label="tomato",confidence=.75,
        bbox=BoundingBox(0,0,100,100),model_name="test.pt",model_version="0",
    )
    assert candidate.to_dict()["verification_status"]=="unverified"
    assert candidate.quantity_min==candidate.quantity_max==1
