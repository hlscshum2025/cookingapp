export const RECEIPT_OCR_SCHEMA_VERSION="receipt-ocr-draft-v1" as const;
export const VISION_CANDIDATE_SCHEMA_VERSION="vision-candidate-v1" as const;

export type VerificationStatus="unverified"|"user_verified"|"rejected";
export type VisionScene="fridge"|"tabletop"|"bagged"|"unknown";

export type BoundingBox={
  x_min:number;
  y_min:number;
  x_max:number;
  y_max:number;
};

export type OcrTextLine={
  text:string;
  confidence:number;
  bbox:BoundingBox;
};

export type ReceiptItemCandidate={
  raw_text:string;
  confidence:number;
  bbox?:BoundingBox|null;
  product_name?:string|null;
  quantity?:number|null;
  quantity_unit?:string|null;
  unit_price?:number|null;
  line_total?:number|null;
  currency:string;
  verification_status:VerificationStatus;
};

/** Exact JSON boundary emitted by vision/src/cooking_vision/contracts.py. */
export type ReceiptOcrDraftV1={
  source_image:string;
  provider:string;
  model_version:string;
  preprocess_version:string;
  schema_version:typeof RECEIPT_OCR_SCHEMA_VERSION;
  created_at:string;
  lines:OcrTextLine[];
  items:ReceiptItemCandidate[];
  warnings:string[];
  raw_result:Record<string,unknown>;
  confirmed:boolean;
};

/** Exact JSON boundary emitted for one detected fridge/tabletop candidate. */
export type VisionCandidateV1={
  source_image:string;
  scene:VisionScene;
  label:string;
  confidence:number;
  bbox:BoundingBox;
  model_name:string;
  model_version:string;
  schema_version:typeof VISION_CANDIDATE_SCHEMA_VERSION;
  canonical_ingredient_key?:string|null;
  mask_polygon?:number[][]|null;
  quantity_min:number;
  quantity_max:number;
  evidence:string[];
  verification_status:VerificationStatus;
};

function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}

function isFiniteNumber(value:unknown):value is number{
  return typeof value==="number"&&Number.isFinite(value);
}

export function isBoundingBox(value:unknown):value is BoundingBox{
  if(!isRecord(value))return false;
  const {x_min,y_min,x_max,y_max}=value;
  return isFiniteNumber(x_min)&&isFiniteNumber(y_min)&&isFiniteNumber(x_max)&&isFiniteNumber(y_max)
    &&x_max>=x_min&&y_max>=y_min;
}

export function isReceiptOcrDraftV1(value:unknown):value is ReceiptOcrDraftV1{
  if(!isRecord(value)||value.schema_version!==RECEIPT_OCR_SCHEMA_VERSION)return false;
  return typeof value.source_image==="string"
    &&typeof value.provider==="string"
    &&typeof value.model_version==="string"
    &&typeof value.preprocess_version==="string"
    &&Array.isArray(value.lines)
    &&Array.isArray(value.items)
    &&Array.isArray(value.warnings)
    &&isRecord(value.raw_result)
    &&typeof value.confirmed==="boolean";
}

export function isVisionCandidateV1(value:unknown):value is VisionCandidateV1{
  if(!isRecord(value)||value.schema_version!==VISION_CANDIDATE_SCHEMA_VERSION)return false;
  return typeof value.source_image==="string"
    &&["fridge","tabletop","bagged","unknown"].includes(String(value.scene))
    &&typeof value.label==="string"
    &&isFiniteNumber(value.confidence)&&value.confidence>=0&&value.confidence<=1
    &&isBoundingBox(value.bbox)
    &&typeof value.model_name==="string"
    &&typeof value.model_version==="string"
    &&Number.isInteger(value.quantity_min)
    &&Number.isInteger(value.quantity_max)
    &&Number(value.quantity_min)>=0
    &&Number(value.quantity_max)>=Number(value.quantity_min)
    &&Array.isArray(value.evidence);
}

