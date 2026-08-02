import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("主页包含 CookingApp 核心入口", async () => {
  const source=await readFile(new URL("../components/Dashboard.tsx",import.meta.url),"utf8");
  assert.match(source,/今天，想做点/);
  assert.match(source,/导入收藏夹/);
  assert.match(source,/新建菜谱/);
});

test("数据库 migration 开启 RLS", async () => {
  const sql=await readFile(new URL("../supabase/migrations/202608020001_cookingapp_v1.sql",import.meta.url),"utf8");
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/recipes public read/);
  assert.match(sql,/logs owner/);
});
