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

test("登录页支持独立账号密码、注册确认和密码恢复", async () => {
  const source=await readFile(new URL("../app/login/page.tsx",import.meta.url),"utf8");
  assert.match(source,/signInWithPassword/);
  assert.match(source,/\.auth\.signUp/);
  assert.match(source,/\.auth\.resend/);
  assert.match(source,/type:"signup"/);
  assert.match(source,/emailRedirectTo:window\.location\.origin/);
  assert.match(source,/resetPasswordForEmail/);
  assert.match(source,/redirectTo:window\.location\.origin/);
  assert.match(source,/新账号只会看到自己的空白知识库/);
  assert.match(source,/管理者也从此处登录/);
  assert.match(source,/getTurnstileSiteKey/);
  assert.match(source,/captchaToken/);
  assert.match(source,/challenges\.cloudflare\.com\/turnstile/);
  assert.doesNotMatch(source,/首次设置/);
  assert.ok(source.indexOf("没有账号？注册新账号")<source.indexOf("忘记密码？"));
});

test("手机底栏按标签、导入、词典、翻译采购、成本排列", async () => {
  const source=await readFile(new URL("../components/AppShell.tsx",import.meta.url),"utf8");
  assert.match(source,/const mobile=\[findNav\("\/tags"\),findNav\("\/imports"\),findNav\("\/ingredients"\),findNav\("\/translations"\),findNav\("\/costs"\)\]/);
});

test("托管生产环境未登录时清空本地副本并统一进入登录页", async () => {
  const provider=await readFile(new URL("../components/CookingProvider.tsx",import.meta.url),"utf8");
  const shell=await readFile(new URL("../components/AppShell.tsx",import.meta.url),"utf8");
  assert.match(provider,/localStorage\.removeItem/);
  assert.match(provider,/setRecipes\(\[\]\);setLogs\(\[\]\);setIngredients\(\[\]\)/);
  assert.match(provider,/ready&&isDemo/);
  assert.match(provider,/connectSupabase/);
  assert.match(provider,/event==="PASSWORD_RECOVERY"/);
  assert.match(provider,/event==="INITIAL_SESSION"/);
  assert.match(provider,/event==="SIGNED_IN"/);
  assert.match(provider,/loadedUserId===session\.user\.id/);
  assert.match(provider,/location\.replace\("\/login\?mode=recovery"\)/);
  assert.match(provider,/setCloudStatus\("unconfigured"\)/);
  assert.match(shell,/cloudStatus==="signed_out"/);
  assert.match(shell,/正在后台同步最新菜谱/);
  assert.match(shell,/router\.prefetch/);
  assert.match(shell,/router\.replace\(`\/login\?next=/);
});

test("未登录导入会明确提示不写入 Supabase", async () => {
  const source=await readFile(new URL("../app/imports/page.tsx",import.meta.url),"utf8");
  assert.match(source,/Supabase 尚未配置：不会收到任何数据/);
  assert.match(source,/CookingApp 尚未登录/);
  assert.match(source,/本机演示导入完成/);
});

test("导入中心读取 source_videos 并串联播放与手工录入", async () => {
  const provider=await readFile(new URL("../components/CookingProvider.tsx",import.meta.url),"utf8");
  const supabase=await readFile(new URL("../lib/supabase.ts",import.meta.url),"utf8");
  const imports=await readFile(new URL("../app/imports/page.tsx",import.meta.url),"utf8");
  assert.match(supabase,/from\("source_videos"\)\.select/);
  assert.match(provider,/sourceVideos/);
  assert.match(imports,/player\.bilibili\.com\/player\.html\?bvid=/);
  assert.match(imports,/在 B 站打开原视频/);
  assert.match(imports,/一键进入手动录入/);
  assert.match(imports,/initialSource=\{selected\}/);
  assert.match(imports,/source-review-card/);
  assert.match(imports,/is-floating/);
  assert.match(imports,/一键自动导入暂时保留入口/);
});

test("设置页区分环境配置、用户登录和当前数据模式并可设置密码", async () => {
  const source=await readFile(new URL("../app/settings/page.tsx",import.meta.url),"utf8");
  assert.match(source,/站点配置不可用/);
  assert.match(source,/已读取 Supabase 配置/);
  assert.match(source,/设置账号登录密码/);
  assert.match(source,/updateUser\(\{password:newPassword\}\)/);
  assert.match(source,/finally\{setPasswordBusy\(false\);\}/);
});
