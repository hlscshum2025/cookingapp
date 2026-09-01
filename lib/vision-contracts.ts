export const RECEIPT_OCR_SCHEMA_VERSION="receipt-ocr-draft-v1" as const;
export const VISION_CANDIDATE_SCHEMA_VERSION="vision-candidate-v1" as const;
export const RECEIPT_OCR_BATCH_SCHEMA_VERSION="receipt-ocr-batch-v1" as const;
export const RECIPE_SCREENSHOT_SCHEMA_VERSION="recipe-screenshot-draft-v1" as const;

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
  bbox:BoundingBox|null;
  product_name:string|null;
  quantity:number|null;
  quantity_unit:string|null;
  package_amount:number|null;
  package_unit:string|null;
  unit_price:number|null;
  line_total:number|null;
  currency:string;
  verification_status:VerificationStatus;
};

export type ReceiptMetadataCandidate={
  store_name:string|null;
  purchase_date:string|null;
  purchase_time:string|null;
  currency:string;
  total_amount:number|null;
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
  metadata:ReceiptMetadataCandidate;
  warnings:string[];
  raw_result:Record<string,unknown>;
  latency_ms:number|null;
  confirmed:boolean;
};

export type ReceiptOcrBatchDraftV1={
  source_images:string[];
  pages:ReceiptOcrDraftV1[];
  schema_version:typeof RECEIPT_OCR_BATCH_SCHEMA_VERSION;
  created_at:string;
  warnings:string[];
  overlap_items_removed:number;
  latency_ms:number|null;
  confirmed:boolean;
};

export type NoteIngredientCandidate={
  raw_text:string;
  name:string|null;
  amount_text:string|null;
  verification_status:VerificationStatus;
};

export type NoteStepCandidate={
  raw_text:string;
  order:number|null;
  verification_status:VerificationStatus;
};

export type NoteOcrPage={
  source_image:string;
  input_index:number;
  crop_mode:"full"|"right";
  crop_bbox:BoundingBox;
  image_width:number;
  image_height:number;
  lines:OcrTextLine[];
  raw_result:Record<string,unknown>;
  latency_ms:number|null;
};

export type RecipeScreenshotDraftV1={
  source_images:string[];
  provider:string;
  model_version:string;
  source_platform:"xiaohongshu";
  preprocess_version:string;
  schema_version:typeof RECIPE_SCREENSHOT_SCHEMA_VERSION;
  created_at:string;
  pages:NoteOcrPage[];
  merged_text_lines:string[];
  title:string|null;
  author:string|null;
  description:string|null;
  ingredients:NoteIngredientCandidate[];
  steps:NoteStepCandidate[];
  warnings:string[];
  raw_result:Record<string,unknown>;
  latency_ms:number|null;
  confirmed:boolean;
};

export type OcrJobStatus="queued"|"running"|"review_required"|"failed";
export type OcrJobV1={
  id:string;
  kind:"receipt"|"xiaohongshu";
  status:OcrJobStatus;
  created_at:string;
  updated_at:string;
  result:ReceiptOcrBatchDraftV1|RecipeScreenshotDraftV1|null;
  error:string|null;
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

function isNullableString(value:unknown):value is string|null{
  return value===null||typeof value==="string";
}

function isNullableNumber(value:unknown):value is number|null{
  return value===null||isFiniteNumber(value);
}

function isVerificationStatus(value:unknown):value is VerificationStatus{
  return ["unverified","user_verified","rejected"].includes(String(value));
}

function isReceiptMetadataCandidate(value:unknown):value is ReceiptMetadataCandidate{
  if(!isRecord(value))return false;
  return isNullableString(value.store_name)
    &&isNullableString(value.purchase_date)
    &&isNullableString(value.purchase_time)
    &&typeof value.currency==="string"
    &&isNullableNumber(value.total_amount);
}

function isOcrTextLine(value:unknown):value is OcrTextLine{
  return isRecord(value)
    &&typeof value.text==="string"
    &&isFiniteNumber(value.confidence)
    &&isBoundingBox(value.bbox);
}

function isReceiptItemCandidate(value:unknown):value is ReceiptItemCandidate{
  if(!isRecord(value))return false;
  return typeof value.raw_text==="string"
    &&isFiniteNumber(value.confidence)
    &&(value.bbox===null||isBoundingBox(value.bbox))
    &&isNullableString(value.product_name)
    &&isNullableNumber(value.quantity)
    &&isNullableString(value.quantity_unit)
    &&isNullableNumber(value.package_amount)
    &&isNullableString(value.package_unit)
    &&isNullableNumber(value.unit_price)
    &&isNullableNumber(value.line_total)
    &&typeof value.currency==="string"
    &&isVerificationStatus(value.verification_status);
}

export function isReceiptOcrDraftV1(value:unknown):value is ReceiptOcrDraftV1{
  if(!isRecord(value)||value.schema_version!==RECEIPT_OCR_SCHEMA_VERSION)return false;
  return typeof value.source_image==="string"
    &&typeof value.provider==="string"
    &&typeof value.model_version==="string"
    &&typeof value.preprocess_version==="string"
    &&typeof value.created_at==="string"
    &&Array.isArray(value.lines)&&value.lines.every(isOcrTextLine)
    &&Array.isArray(value.items)&&value.items.every(isReceiptItemCandidate)
    &&isReceiptMetadataCandidate(value.metadata)
    &&Array.isArray(value.warnings)&&value.warnings.every(item=>typeof item==="string")
    &&isRecord(value.raw_result)
    &&(value.latency_ms===null||(isFiniteNumber(value.latency_ms)&&Number.isInteger(value.latency_ms)&&value.latency_ms>=0))
    &&typeof value.confirmed==="boolean";
}

export function isReceiptOcrBatchDraftV1(value:unknown):value is ReceiptOcrBatchDraftV1{
  if(!isRecord(value)||value.schema_version!==RECEIPT_OCR_BATCH_SCHEMA_VERSION)return false;
  return Array.isArray(value.source_images)&&value.source_images.every(item=>typeof item==="string")
    &&Array.isArray(value.pages)&&value.pages.every(isReceiptOcrDraftV1)
    &&typeof value.created_at==="string"
    &&Array.isArray(value.warnings)&&value.warnings.every(item=>typeof item==="string")
    &&Number.isInteger(value.overlap_items_removed)&&Number(value.overlap_items_removed)>=0
    &&(value.latency_ms===null||(Number.isInteger(value.latency_ms)&&Number(value.latency_ms)>=0))
    &&typeof value.confirmed==="boolean";
}

function isNotePage(value:unknown):value is NoteOcrPage{
  return isRecord(value)&&typeof value.source_image==="string"
    &&Number.isInteger(value.input_index)&&Number(value.input_index)>0
    &&["full","right"].includes(String(value.crop_mode))
    &&isBoundingBox(value.crop_bbox)
    &&Number.isInteger(value.image_width)&&Number(value.image_width)>0
    &&Number.isInteger(value.image_height)&&Number(value.image_height)>0
    &&Array.isArray(value.lines)&&value.lines.every(isOcrTextLine)
    &&isRecord(value.raw_result)
    &&(value.latency_ms===null||(Number.isInteger(value.latency_ms)&&Number(value.latency_ms)>=0));
}

export function isRecipeScreenshotDraftV1(value:unknown):value is RecipeScreenshotDraftV1{
  if(!isRecord(value)||value.schema_version!==RECIPE_SCREENSHOT_SCHEMA_VERSION)return false;
  return Array.isArray(value.source_images)&&value.source_images.every(item=>typeof item==="string")
    &&typeof value.provider==="string"&&typeof value.model_version==="string"
    &&value.source_platform==="xiaohongshu"&&typeof value.preprocess_version==="string"
    &&typeof value.created_at==="string"&&Array.isArray(value.pages)&&value.pages.every(isNotePage)
    &&Array.isArray(value.merged_text_lines)&&value.merged_text_lines.every(item=>typeof item==="string")
    &&isNullableString(value.title)&&isNullableString(value.author)&&isNullableString(value.description)
    &&Array.isArray(value.ingredients)&&Array.isArray(value.steps)
    &&Array.isArray(value.warnings)&&value.warnings.every(item=>typeof item==="string")
    &&isRecord(value.raw_result)&&typeof value.confirmed==="boolean";
}

export function isOcrJobV1(value:unknown):value is OcrJobV1{
  if(!isRecord(value)||typeof value.id!=="string")return false;
  const validResult=value.result===null||isReceiptOcrBatchDraftV1(value.result)||isRecipeScreenshotDraftV1(value.result);
  return ["receipt","xiaohongshu"].includes(String(value.kind))
    &&["queued","running","review_required","failed"].includes(String(value.status))
    &&typeof value.created_at==="string"&&typeof value.updated_at==="string"
    &&validResult&&(value.error===null||typeof value.error==="string");
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
