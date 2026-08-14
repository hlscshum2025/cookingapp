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
