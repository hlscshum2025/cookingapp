import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

async function builtWorker(){
  const url=pathToFileURL(new URL("../dist/server/index.js",import.meta.url).pathname);
  url.searchParams.set("runtime-config-test",`${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(url.href)).default;
}

const ctx={waitUntil(){},passThroughOnException(){}};

test("运行时接口只返回 Supabase 浏览器公开配置",async()=>{
  const worker=await builtWorker();
  const response=await worker.fetch(new Request("https://cookingapp.example/api/runtime-config"),{
    NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test_public_key",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY:"0x4AAAAAAAtest_public_site_key",
    SUPABASE_SECRET_KEY:"must-not-leak",
  },ctx);
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control"),/max-age=300/);
  assert.deepEqual(await response.json(),{
    supabaseUrl:"https://project.supabase.co",
    supabasePublishableKey:"sb_publishable_test_public_key",
    turnstileSiteKey:"0x4AAAAAAAtest_public_site_key",
  });
});

test("运行时配置缺失时明确失败而不是让登录按钮一直等待",async()=>{
  const worker=await builtWorker();
  const response=await worker.fetch(new Request("https://cookingapp.example/api/runtime-config"),{},ctx);
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/unavailable/i);
});
