import assert from "node:assert/strict";
import test from "node:test";

import { parseSharedRecipeSource } from "../lib/source-adapters.ts";

test("识别下厨房菜谱链接和 recipe id",()=>{
  const source=parseSharedRecipeSource("红烧牛肉\n作者：小曹\nhttps://www.xiachufang.com/recipe/107123456/");
  assert.equal(source.platform,"xiachufang");
  assert.equal(source.platformLabel,"下厨房");
  assert.equal(source.externalId,"107123456");
  assert.equal(source.title,"红烧牛肉");
  assert.equal(source.uploaderName,"小曹");
});

test("识别小红书分享文本",()=>{
  const source=parseSharedRecipeSource("空气炸锅鸡翅太香了 @厨房同学 https://www.xiaohongshu.com/explore/66abc123def456");
  assert.equal(source.platform,"xiaohongshu");
  assert.equal(source.externalId,"66abc123def456");
  assert.equal(source.uploaderName,"厨房同学");
});

test("识别小红书单行复制分享并提取真正标题",()=>{
  const source=parseSharedRecipeSource("85 【GB留子日常必备手作桃花酥 - 苹果理学的羁绊 | 小红书 - 你的生活兴趣社区】 😍 https://www.xiaohongshu.com/discovery/item/69a98700000000002202c2cc?source=webshare&xsec_token=test");
  assert.equal(source.platform,"xiaohongshu");
  assert.equal(source.externalId,"69a98700000000002202c2cc");
  assert.equal(source.title,"GB留子日常必备手作桃花酥");
  assert.equal(source.uploaderName,"苹果理学的羁绊");
  assert.equal(source.url,"https://www.xiaohongshu.com/discovery/item/69a98700000000002202c2cc?source=webshare&xsec_token=test");
});

test("识别 Bilibili 单视频来源",()=>{
  const source=parseSharedRecipeSource("夏叔做饭 https://www.bilibili.com/video/BV1TEST12345");
  assert.equal(source.platform,"bilibili");
  assert.equal(source.externalId,"BV1TEST12345");
});

test("其他菜谱链接进入通用网页适配器",()=>{
  const source=parseSharedRecipeSource("My recipe\nhttps://example.com/recipes/noodle?id=2");
  assert.equal(source.platform,"generic_web");
  assert.equal(source.url,"https://example.com/recipes/noodle?id=2");
  assert.match(source.externalId,/^generic_web-/);
});

test("没有链接时给出明确错误",()=>{
  assert.throws(()=>parseSharedRecipeSource("只有一段菜谱文字，没有链接"),/没有识别到/);
});
