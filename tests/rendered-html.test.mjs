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

test("手动录入 migration 使用登录用户并原子保存来源版本", async () => {
  const sql=await readFile(new URL("../supabase/migrations/202608090001_manual_recipe_entry.sql",import.meta.url),"utf8");
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/source_extracted/);
  assert.match(sql,/on conflict\(owner_id,platform,external_id\)/i);
});

test("内部触发器函数不能被匿名或普通用户直接调用", async () => {
  const sql=await readFile(new URL("../supabase/migrations/202608090002_trigger_security_hardening.sql",import.meta.url),"utf8");
  assert.match(sql,/handle_new_user\(\).*public, anon, authenticated/i);
  assert.match(sql,/snapshot_recipe_update\(\).*public, anon, authenticated/i);
});

test("私有首版 migration 关闭匿名菜谱并校验跨用户关联", async () => {
  const sql=await readFile(new URL("../supabase/migrations/20260810060929_harden_rls_cross_owner_relations.sql",import.meta.url),"utf8");
  assert.match(sql,/drop policy if exists "recipes public read"/i);
  assert.ok((sql.match(/to authenticated/gi)??[]).length>=12);
  assert.match(sql,/recipes\.id = recipe_versions\.recipe_id/i);
  assert.match(sql,/import_jobs\.id = import_items\.job_id/i);
  assert.match(sql,/source_videos\.id = import_items\.source_video_id/i);
  assert.match(sql,/tags\.id = recipe_tags\.tag_id/i);
  assert.match(sql,/from public, anon, authenticated/i);
});

test("RLS 矩阵覆盖 115 项并显式清理测试身份", async () => {
  const sql=await readFile(new URL("../supabase/tests/rls_privacy_matrix.sql",import.meta.url),"utf8");
  assert.match(sql,/expect_count\(115,/i);
  assert.match(sql,/delete from auth\.users/i);
  assert.match(sql,/cross_user_association/i);
  assert.match(sql,/owner_tamper/i);
  assert.match(sql,/rpc_regression/i);
});

test("登录页说明这是 CookingApp 的 Supabase Auth 登录", async () => {
  const source=await readFile(new URL("../app/login/page.tsx",import.meta.url),"utf8");
  assert.match(source,/不是登录 GitHub、域名或 Supabase Dashboard/);
  assert.match(source,/第一次也不用先注册/);
});

test("未登录导入会明确提示不写入 Supabase", async () => {
  const source=await readFile(new URL("../app/imports/page.tsx",import.meta.url),"utf8");
  assert.match(source,/Supabase 尚未配置：不会收到任何数据/);
  assert.match(source,/Supabase 配置已读取，但 CookingApp 尚未登录/);
  assert.match(source,/本机演示导入完成（未写入 Supabase）/);
});

test("设置页区分环境配置、用户登录和当前数据模式", async () => {
  const source=await readFile(new URL("../app/settings/page.tsx",import.meta.url),"utf8");
  assert.match(source,/未读取到 \.env\.local/);
  assert.match(source,/已读取 Supabase 配置/);
  assert.match(source,/现在只差点击邮箱魔法链接/);
});
