import assert from "node:assert/strict";
import test from "node:test";

import { extractSourcePage,parseIngredientText } from "../lib/source-extractor.ts";

test("食材文字拆成名称、用量和单位",()=>{
  assert.deepEqual(parseIngredientText("牛腩 600克"),{name:"牛腩",amount:"600",unit:"克"});
  assert.deepEqual(parseIngredientText("2勺 料酒"),{name:"料酒",amount:"2",unit:"勺"});
  assert.deepEqual(parseIngredientText("盐 适量"),{name:"盐",amount:"适量",unit:""});
});

test("优先从 Recipe JSON-LD 读取下厨房式文本菜谱",()=>{
  const html=`<html><head><meta property="og:image" content="https://img.example/cover.jpg"><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Recipe","name":"番茄牛腩","author":{"name":"测试作者"},"description":"家常炖煮版本","recipeIngredient":["牛腩 600克","料酒 2勺","番茄 3个"],"recipeInstructions":[{"@type":"HowToStep","text":"牛腩焯水洗净"},{"@type":"HowToStep","text":"加入番茄小火炖煮"}]})}</script></head></html>`;
  const result=extractSourcePage(html,"https://www.xiachufang.com/recipe/123/","xiachufang");
  assert.equal(result.title,"番茄牛腩");
  assert.equal(result.uploaderName,"测试作者");
  assert.equal(result.extractedRecipe?.ingredients.length,3);
  assert.equal(result.extractedRecipe?.steps[1],"加入番茄小火炖煮");
  assert.equal(result.extractionMethod,"json_ld");
});

test("小红书页面正文可作为自动读取内容",()=>{
  const html=`<html><head><meta property="og:title" content="桃花酥 - 小红书"><meta property="og:description" content="用料：面粉 200克；黄油 80克 做法：1.混合面团 2.包馅烘烤"></head></html>`;
  const result=extractSourcePage(html,"https://www.xiaohongshu.com/explore/abc","xiaohongshu");
  assert.equal(result.title,"桃花酥");
  assert.ok(result.description.includes("面粉"));
});
