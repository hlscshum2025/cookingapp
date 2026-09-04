import numpy as np

from cooking_vision.contracts import BoundingBox, OcrTextLine
from cooking_vision.receipt import pipeline
from cooking_vision.receipt.preprocess import PreprocessResult


def _line(text: str, y: float) -> OcrTextLine:
    return OcrTextLine(text=text, confidence=0.9, bbox=BoundingBox(0, y, 200, y + 20))


def test_sparse_first_pass_retries_enhanced_image(monkeypatch, tmp_path):
    image = np.zeros((120, 300, 3), dtype=np.uint8)
    gray = np.zeros((120, 300), dtype=np.uint8)
    processed = PreprocessResult(image, image, gray, gray, False)
    monkeypatch.setattr(pipeline, "preprocess_receipt", lambda *_args, **_kwargs: processed)
    calls = []

    def fake_ocr(received, **_kwargs):
        calls.append(received)
        if len(calls) == 1:
            return [_line("Kartenzahlung", 100)], [], "test"
        return [
            _line("BIO TOMATEN 2,49", 10),
            _line("H-MILCH 1,19", 40),
            _line("TASCHE 0,25", 70),
            _line("Kartenzahlung", 100),
        ], [], "test"

    monkeypatch.setattr(pipeline, "run_paddle_ocr", fake_ocr)
    draft = pipeline.build_receipt_draft(tmp_path / "unused.jpg")

    assert len(calls) == 2
    assert calls[1].shape == (120, 300, 3)
    assert [item.product_name for item in draft.items] == [
        "BIO TOMATEN",
        "H-MILCH",
        "TASCHE",
    ]
    assert draft.raw_result["fallback_used"] is True


def test_long_receipt_is_split_into_overlapping_vertical_tiles():
    image=np.zeros((5000,960,3),dtype=np.uint8)

    tiles=pipeline._vertical_tiles(image,2200)

    assert len(tiles)==3
    assert tiles[0][0]==0
    assert tiles[-1][0]+tiles[-1][1].shape[0]==5000
    assert all(tile.shape[0]<=2200 for _,tile in tiles)
    assert tiles[1][0]<tiles[0][1].shape[0]
