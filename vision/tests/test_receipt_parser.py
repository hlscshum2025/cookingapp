from cooking_vision.contracts import BoundingBox,OcrTextLine
from cooking_vision.receipt.parser import extract_item_candidates,extract_metadata,merge_ocr_rows,parse_decimal


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


def test_merges_product_and_right_aligned_price_boxes():
    rows=merge_ocr_rows([
        OcrTextLine("BIO TOMATEN",.91,BoundingBox(0,10,70,30)),
        OcrTextLine("2,49",.95,BoundingBox(180,11,220,31)),
    ])
    assert len(rows)==1
    assert rows[0].text=="BIO TOMATEN 2,49"
    assert extract_item_candidates(rows)[0].line_total==2.49


def test_extracts_store_date_time_and_total_metadata():
    metadata=extract_metadata([
        line("REWE Markt GmbH"),
        line("27.08.2026 18:42"),
        line("ZU ZAHLEN EUR 1.234,56"),
    ])
    assert metadata.store_name=="REWE"
    assert metadata.purchase_date=="2026-08-27"
    assert metadata.purchase_time=="18:42"
    assert metadata.total_amount==1234.56


def test_barilla_is_not_mistaken_for_cash_payment():
    items=extract_item_candidates([line("BARILLA SPAGHETTI 1,79"),line("BAR 20,00")])
    assert [item.product_name for item in items]==["BARILLA SPAGHETTI"]


def test_extracts_multipack_and_unit_price():
    items=extract_item_candidates([
        line("JOGHURT 2 X 500G 2,98"),
        line("H-MILCH 2 X 1,19 2,38"),
    ])
    assert items[0].quantity==1000
    assert items[0].quantity_unit=="g"
    assert items[0].package_amount==500
    assert items[1].quantity==2
    assert items[1].quantity_unit=="pcs"
    assert items[1].unit_price==1.19


def test_parses_german_thousands_separator():
    assert parse_decimal("1.234,56")==1234.56
