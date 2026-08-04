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
