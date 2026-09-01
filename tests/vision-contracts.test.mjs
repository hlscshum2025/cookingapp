import test from "node:test";
import assert from "node:assert/strict";
import {isOcrJobV1,isReceiptOcrDraftV1} from "../lib/vision-contracts.ts";

const box={x_min:0,y_min:1,x_max:100,y_max:20};

test("网页契约接受 PR5 的完整小票 OCR JSON",()=>{
  const draft={
    source_image:"data/raw/receipts/rewe.jpg",
    provider:"paddleocr",
    model_version:"PP-OCRv6",
    preprocess_version:"opencv-baseline-v1",
    schema_version:"receipt-ocr-draft-v1",
    created_at:"2026-08-31T00:00:00+00:00",
    lines:[{text:"BIO TOMATEN 2,49",confidence:.93,bbox:box}],
    items:[{
      raw_text:"BIO TOMATEN 500G 2,49",
      confidence:.93,
      bbox:box,
      product_name:"BIO TOMATEN 500G",
      quantity:500,
      quantity_unit:"g",
      package_amount:500,
      package_unit:"g",
      unit_price:null,
      line_total:2.49,
      currency:"EUR",
      verification_status:"unverified",
    }],
    metadata:{
      store_name:"REWE",
      purchase_date:"2026-08-31",
      purchase_time:"18:42",
      currency:"EUR",
      total_amount:18.42,
    },
    warnings:[],
    raw_result:{document_found:true},
    latency_ms:3210,
    confirmed:false,
  };

  assert.equal(isReceiptOcrDraftV1(draft),true);
  assert.equal(isReceiptOcrDraftV1({...draft,metadata:undefined}),false);
  assert.equal(isReceiptOcrDraftV1({...draft,latency_ms:-1}),false);
});

test("网页契约接受多页小票异步审核任务",()=>{
  const page={
    source_image:"receipt-01.jpg",provider:"paddleocr",model_version:"PP-OCRv6",
    preprocess_version:"opencv-baseline-v1",schema_version:"receipt-ocr-draft-v1",
    created_at:"2026-09-01T00:00:00+00:00",lines:[],items:[],
    metadata:{store_name:null,purchase_date:null,purchase_time:null,currency:"EUR",total_amount:null},
    warnings:[],raw_result:{},latency_ms:100,confirmed:false,
  };
  const job={
    id:"job-1",kind:"receipt",status:"review_required",
    created_at:"2026-09-01T00:00:00+00:00",updated_at:"2026-09-01T00:00:01+00:00",
    result:{source_images:["receipt-01.jpg"],pages:[page],schema_version:"receipt-ocr-batch-v1",created_at:"2026-09-01T00:00:00+00:00",warnings:[],overlap_items_removed:0,latency_ms:100,confirmed:false},
    error:null,
  };
  assert.equal(isOcrJobV1(job),true);
  assert.equal(isOcrJobV1({...job,status:"confirmed"}),false);
});
