import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("导入审计函数中的 recipes insert 正确结束", async () => {
  const sql=await readFile(new URL("../supabase/migrations/202608030001_import_audit.sql",import.meta.url),"utf8");
  assert.match(sql,/to_char\(current_date,'YYYY-MM-DD'\)\)\);\s+v_added := v_added \+ 1;/);
});

test("四份 SQL 的后两份检查脚本保持只读", async () => {
  const installation=await readFile(new URL("../supabase/checks/03_verify_installation.sql",import.meta.url),"utf8");
  const data=await readFile(new URL("../supabase/checks/04_verify_cloud_data.sql",import.meta.url),"utf8");
  for(const sql of [installation,data]){
    assert.doesNotMatch(sql,/\b(insert|update|delete|alter|drop|create|truncate)\b/i);
  }
});

test("线上冰箱 migration 开启 owner-only RLS 且不授权 anon", async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202608140001_pantry_inventory.sql",import.meta.url),"utf8");
  assert.match(sql,/alter table public\.pantry_items enable row level security/i);
  assert.match(sql,/revoke all on public\.pantry_items from anon/i);
  assert.match(sql,/for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = owner_id\)/i);
  assert.match(sql,/for insert\s+to authenticated\s+with check \(\(select auth\.uid\(\)\) = owner_id\)/i);
  assert.match(sql,/for update\s+to authenticated[\s\S]+using \(\(select auth\.uid\(\)\) = owner_id\)[\s\S]+with check \(\(select auth\.uid\(\)\) = owner_id\)/i);
  assert.match(sql,/for delete\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = owner_id\)/i);
});

test("我的粮仓 migration 限制存放位置并提供查询索引", async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202608220001_pantry_storage_location.sql",import.meta.url),"utf8");
  assert.match(sql,/storage_location text not null default 'fridge'/i);
  assert.match(sql,/storage_location in \('fridge','cabinet'\)/i);
  assert.match(sql,/pantry_items\(owner_id,storage_location,updated_at desc\)/i);
});

test("反馈队列允许用户提交自己的反馈并限制管理员审核",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202608220001_feedback_submissions.sql",import.meta.url),"utf8");
  assert.match(sql,/alter table public\.feedback_submissions enable row level security/i);
  assert.match(sql,/revoke all privileges on table public\.feedback_submissions from anon, authenticated/i);
  assert.match(sql,/for insert to authenticated[\s\S]+auth\.uid\(\)\)=owner_id[\s\S]+status='new'/i);
  assert.match(sql,/for update to authenticated[\s\S]+using \(private\.is_current_admin\(\)\)[\s\S]+with check \(private\.is_current_admin\(\)\)/i);
});

test("小票 OCR migration 保持原图、原始识别和采购记录为 owner-only",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202608220002_receipt_ocr_schema.sql",import.meta.url),"utf8");
  for(const table of ["shopping_receipts","receipt_ocr_runs","shopping_receipt_items","purchase_records","ingredient_market_aliases"]){
    assert.match(sql,new RegExp(`create table if not exists public\\.${table}`,"i"));
    assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,"i"));
  }
  assert.match(sql,/revoke all privileges on table[\s\S]+from anon, authenticated/i);
  assert.match(sql,/create policy[\s\S]+for select to authenticated using \(\(select auth\.uid\(\)\)=owner_id\)/i);
  assert.match(sql,/verification_status in \('unverified','user_verified','rejected'\)/i);
  assert.match(sql,/receipt-images[\s\S]+public=false/i);
});

test("小票 OCR owner 复合外键都有覆盖索引",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/202608220003_receipt_ocr_fk_indexes.sql",import.meta.url),"utf8");
  assert.match(sql,/receipt_ocr_runs\(receipt_id,owner_id,created_at desc\)/i);
  assert.match(sql,/shopping_receipt_items\(receipt_id,owner_id,created_at\)/i);
  assert.match(sql,/shopping_receipt_items\(ocr_run_id,owner_id\)/i);
  assert.match(sql,/purchase_records\(source_receipt_item_id,owner_id\)/i);
});
