from cooking_vision.contracts import BoundingBox,OcrTextLine
from cooking_vision.receipt.parser import extract_item_candidates


def line(text:str,confidence:float=.9)->OcrTextLine:
    return OcrTextLine(text=text,confidence=confidence,bbox=BoundingBox(0,0,100,20))


def test_extracts_german_price_and_quantity():
    items=extract_item_candidates([line("BIO TOMATEN 500G 2,49")])
    assert len(items)==1
    assert items[0].product_name=="BIO TOMATEN 500G"
    assert items[0].quantity==500
    assert items[0].quantity_unit=="g"
    assert items[0].line_total==2.49


def test_ignores_totals_and_keeps_unverified_boundary():
    items=extract_item_candidates([line("GESAMT EUR 18,42"),line("H-MILCH 1,19")])
    assert [item.product_name for item in items]==["H-MILCH"]
    assert items[0].verification_status=="unverified"
