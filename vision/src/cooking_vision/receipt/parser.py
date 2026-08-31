from __future__ import annotations

import re
from datetime import date
from statistics import median

from cooking_vision.contracts import (
    BoundingBox,
    OcrTextLine,
    ReceiptItemCandidate,
    ReceiptMetadataCandidate,
)


MONEY=r"[-−]?\d{1,4}(?:[.\s]\d{3})*[,.]\d{2}"
PRICE_AT_END=re.compile(rf"(?<!\d)({MONEY})\s*(?:€|EUR|[A-D])?\s*$",re.IGNORECASE)
QUANTITY=re.compile(r"(?<!\d)(\d+(?:[,.]\d+)?)\s*(KG|G|L|ML|STK|ST|PCS?)\b",re.IGNORECASE)
WEIGHT_MULTIPACK=re.compile(
    r"(?<!\d)(\d+)\s*[xX]\s*(\d+(?:[,.]\d+)?)\s*(KG|G|L|ML|STK|ST|PCS?)\b",
    re.IGNORECASE,
)
COUNT_AT_UNIT_PRICE=re.compile(r"(?<!\d)(\d+)\s*[xX]\s*(\d{1,4}[,.]\d{2})(?!\d)",re.IGNORECASE)
DATE_PATTERN=re.compile(r"(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?!\d)")
TIME_PATTERN=re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)")
NON_ITEM_PATTERN=re.compile(
    r"\b(?:SUMME|GESAMT|TOTAL|ENDSUMME|ZU\s+ZAHLEN|ZAHLUNG|BAR|KARTE|EC[- ]?KARTE|"
    r"RÜCKGELD|MWST|UST|NETTO|BRUTTO)\b",
    re.IGNORECASE,
)
TOTAL_PATTERNS=(
    (3,re.compile(r"\b(?:ZU\s+ZAHLEN|ENDSUMME|GESAMTBETRAG|ZAHLBETRAG)\b",re.IGNORECASE)),
    (2,re.compile(r"\b(?:GESAMT|TOTAL)\b",re.IGNORECASE)),
    (1,re.compile(r"\bSUMME\b",re.IGNORECASE)),
)
TAX_OR_NET_SUBTOTAL_PATTERN=re.compile(
    r"\b(?:MWST|UST|NETTO|STEUER|STEUERSATZ)\b",
    re.IGNORECASE,
)
NETTO_STORE_PATTERN=re.compile(
    r"^NETTO(?:\s+(?:MARKEN[- ]DISCOUNT|MARKT|FILIALE)\b.*)?$",
    re.IGNORECASE,
)
STORE_ALIASES=(
    ("KAUFLAND","Kaufland"),
    ("ALDI SÜD","ALDI Süd"),
    ("ALDI NORD","ALDI Nord"),
    ("ALDI","ALDI"),
    ("EDEKA","EDEKA"),
    ("REWE","REWE"),
    ("LIDL","Lidl"),
    ("NETTO","Netto"),
    ("PENNY","PENNY"),
    ("NORMA","NORMA"),
    ("ROSSMANN","ROSSMANN"),
    ("DM DROGERIE","dm"),
)


def parse_decimal(value:str)->float:
    normalized=value.replace("−","-").replace(" ","")
    if "," in normalized:
        normalized=normalized.replace(".","").replace(",",".")
    return float(normalized)


def _row_box(lines:list[OcrTextLine])->BoundingBox:
    return BoundingBox(
        min(line.bbox.x_min for line in lines),
        min(line.bbox.y_min for line in lines),
        max(line.bbox.x_max for line in lines),
        max(line.bbox.y_max for line in lines),
    )


def merge_ocr_rows(lines:list[OcrTextLine],y_tolerance_ratio:float=.55)->list[OcrTextLine]:
    """Merge boxes on the same visual row before receipt parsing.

    PaddleOCR may return a product name and its right-aligned price as separate
    boxes. Keeping that split would lose otherwise valid item rows.
    """
    if not lines:
        return []
    heights=[max(1.0,line.bbox.y_max-line.bbox.y_min) for line in lines]
    tolerance=max(4.0,median(heights)*y_tolerance_ratio)
    rows:list[list[OcrTextLine]]=[]
    row_centers:list[float]=[]
    for line in sorted(lines,key=lambda item:((item.bbox.y_min+item.bbox.y_max)/2,item.bbox.x_min)):
        center=(line.bbox.y_min+line.bbox.y_max)/2
        if rows and abs(center-row_centers[-1])<=tolerance:
            rows[-1].append(line)
            row_centers[-1]=sum((item.bbox.y_min+item.bbox.y_max)/2 for item in rows[-1])/len(rows[-1])
        else:
            rows.append([line])
            row_centers.append(center)
    merged:list[OcrTextLine]=[]
    for row in rows:
        ordered=sorted(row,key=lambda item:item.bbox.x_min)
        merged.append(OcrTextLine(
            text=" ".join(item.text.strip() for item in ordered if item.text.strip()),
            confidence=sum(item.confidence for item in ordered)/len(ordered),
            bbox=_row_box(ordered),
        ))
    return merged


def _normalized_date(match:re.Match[str])->str|None:
    day,month,year=(int(part) for part in match.groups())
    if year<100:
        year+=2000
    try:
        return date(year,month,day).isoformat()
    except ValueError:
        return None


def extract_metadata(lines:list[OcrTextLine])->ReceiptMetadataCandidate:
    store_name:str|None=None
    purchase_date:str|None=None
    purchase_time:str|None=None
    total_amount:float|None=None
    total_priority=-1
    for index,line in enumerate(lines):
        text=" ".join(line.text.strip().split())
        upper=text.upper()
        if store_name is None and index<15:
            for alias,canonical in STORE_ALIASES:
                if alias=="NETTO" and not NETTO_STORE_PATTERN.fullmatch(upper):
                    continue
                if alias in upper:
                    store_name=canonical
                    break
        if purchase_date is None:
            match=DATE_PATTERN.search(text)
            if match:
                purchase_date=_normalized_date(match)
        if purchase_time is None:
            match=TIME_PATTERN.search(text)
            if match:
                purchase_time=f"{int(match.group(1)):02d}:{match.group(2)}"
        if TAX_OR_NET_SUBTOTAL_PATTERN.search(text):
            continue
        priority=next((rank for rank,pattern in TOTAL_PATTERNS if pattern.search(text)),None)
        if priority is not None and priority>=total_priority:
            match=PRICE_AT_END.search(text)
            if match:
                parsed=parse_decimal(match.group(1))
                if parsed>=0:
                    total_amount=parsed
                    total_priority=priority
    return ReceiptMetadataCandidate(
        store_name=store_name,
        purchase_date=purchase_date,
        purchase_time=purchase_time,
        total_amount=total_amount,
    )


def _quantity(text:str)->tuple[float|None,str|None,float|None,str|None,float|None]:
    pack=WEIGHT_MULTIPACK.search(text)
    if pack:
        count=float(pack.group(1))
        amount=parse_decimal(pack.group(2))
        unit=pack.group(3).lower()
        return count*amount,unit,amount,unit,None
    match=QUANTITY.search(text)
    if match:
        amount=parse_decimal(match.group(1))
        unit=match.group(2).lower()
        return amount,unit,amount,unit,None
    count_price=COUNT_AT_UNIT_PRICE.search(text)
    if count_price:
        return float(count_price.group(1)),"pcs",None,None,parse_decimal(count_price.group(2))
    return None,None,None,None,None


def extract_item_candidates(lines:list[OcrTextLine])->list[ReceiptItemCandidate]:
    """Create conservative candidates; unknown and discount lines stay in the OCR draft."""
    candidates:list[ReceiptItemCandidate]=[]
    for line in lines:
        text=" ".join(line.text.strip().split())
        if not text or NON_ITEM_PATTERN.search(text):
            continue
        price_match=PRICE_AT_END.search(text)
        if not price_match:
            continue
        line_total=parse_decimal(price_match.group(1))
        if line_total<0:
            continue
        product_name=text[:price_match.start()].strip(" -.*") or None
        if product_name is None or not re.search(r"[A-Za-zÄÖÜäöüß]",product_name):
            continue
        quantity,unit,package_amount,package_unit,unit_price=_quantity(product_name)
        candidates.append(ReceiptItemCandidate(
            raw_text=text,
            product_name=product_name,
            quantity=quantity,
            quantity_unit=unit,
            package_amount=package_amount,
            package_unit=package_unit,
            unit_price=unit_price,
            line_total=line_total,
            confidence=line.confidence,
            bbox=line.bbox,
        ))
    return candidates
