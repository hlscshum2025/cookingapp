from cooking_vision.contracts import ReceiptItemCandidate, ReceiptOcrDraft
from cooking_vision.receipt.multipage import build_receipt_batch_draft


def test_long_receipt_pages_keep_order_and_remove_boundary_duplicate():
    drafts = {
        "one.jpg": ReceiptOcrDraft(
            source_image="one.jpg", provider="fake", model_version="test",
            items=[ReceiptItemCandidate("MILCH 1,49", 0.9), ReceiptItemCandidate("BROT 2,29", 0.9)],
        ),
        "two.jpg": ReceiptOcrDraft(
            source_image="two.jpg", provider="fake", model_version="test",
            items=[ReceiptItemCandidate("BROT 2,29", 0.9), ReceiptItemCandidate("EI 3,19", 0.9)],
        ),
    }

    def fake_builder(path, **_kwargs):
        return drafts[str(path)]

    result = build_receipt_batch_draft(["one.jpg", "two.jpg"], page_builder=fake_builder)

    assert [page.source_image for page in result.pages] == ["one.jpg", "two.jpg"]
    assert [item.raw_text for item in result.pages[1].items] == ["EI 3,19"]
    assert result.overlap_items_removed == 1
    assert result.confirmed is False
