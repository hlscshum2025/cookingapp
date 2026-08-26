from __future__ import annotations

import re

from cooking_vision.contracts import OcrTextLine, ReceiptItemCandidate


PRICE_AT_END=re.compile(r"(?<!\d)(\d{1,4}[,.]\d{2})\s*(?:€|EUR|A|B)?\s*$",re.IGNORECASE)
QUANTITY=re.compile(r"(?<!\d)(\d+(?:[,.]\d+)?)\s*(KG|G|L|ML|STK|ST|PCS?)\b",re.IGNORECASE)
MULTIPACK=re.compile(r"(?<!\d)(\d+)\s*[xX]\s*(\d+(?:[,.]\d+)?)?\s*(KG|G|L|ML|STK|ST|PCS?)?",re.IGNORECASE)
TOTAL_WORDS=("SUMME","GESAMT","TOTAL","ZAHLUNG","BAR","KARTE","RÜCKGELD","MWST","UST")


def parse_decimal(value:str)->float:
    return float(value.replace(".","").replace(",",".")) if "," in value else float(value)


def _quantity(text:str)->tuple[float|None,str|None]:
    match=QUANTITY.search(text)
    if match:
        return parse_decimal(match.group(1)),match.group(2).lower()
    pack=MULTIPACK.search(text)
    if pack and pack.group(2):
        count=float(pack.group(1))
        amount=parse_decimal(pack.group(2))
        return count*amount,(pack.group(3) or "pcs").lower()
    return None,None


def extract_item_candidates(lines:list[OcrTextLine])->list[ReceiptItemCandidate]:
    """Create conservative candidates; unknown lines stay in the OCR draft."""
    candidates:list[ReceiptItemCandidate]=[]
    for line in lines:
        text=" ".join(line.text.strip().split())
        if not text or any(word in text.upper() for word in TOTAL_WORDS):
            continue
        price_match=PRICE_AT_END.search(text)
        if not price_match:
            continue
        product_name=text[:price_match.start()].strip(" -.*") or None
        quantity,unit=_quantity(text)
        candidates.append(ReceiptItemCandidate(
            raw_text=text,
            product_name=product_name,
            quantity=quantity,
            quantity_unit=unit,
            line_total=parse_decimal(price_match.group(1)),
            confidence=line.confidence,
            bbox=line.bbox,
        ))
    return candidates
