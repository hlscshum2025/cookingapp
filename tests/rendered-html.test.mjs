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
