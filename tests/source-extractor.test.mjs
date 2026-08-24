import assert from "node:assert/strict";
import test from "node:test";

import { extractSourcePage,parseIngredientText } from "../lib/source-extractor.ts";

test("食材文字拆成名称、用量和单位",()=>{
  assert.deepEqual(parseIngredientText("牛腩 600克"),{name:"牛腩",amount:"600",unit:"克"});
  assert.deepEqual(parseIngredientText("2勺 料酒"),{name:"料酒",amount:"2",unit:"勺"});
  assert.deepEqual(parseIngredientText("500g鸡翅"),{name:"鸡翅",amount:"500",unit:"g"});
  assert.deepEqual(parseIngredientText("2勺东古红烧酱油"),{name:"东古红烧酱油",amount:"2",unit:"勺"});
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

test("下厨房 MIP 中文用料标题会拆出食材与用量",()=>{
  const html=`<html><head><title>【步骤图】公瑾爆蛋的做法_公瑾爆蛋的做法步骤_早餐_下厨房</title></head><body>
    <section id="ings"><h3>用料</h3><div class="recipe-ingredient">
      <a class="ing-line"><div class="ing-name">鸡蛋</div><div class="ing-amount">6个</div></a>
      <a class="ing-line"><div class="ing-name">大蒜</div><div class="ing-amount">2瓣</div></a>
    </div></section><section><h3>公瑾爆蛋的做法步骤</h3>
      <div>步骤 1</div><p>锅里热油煎蛋。</p><div>步骤 2</div><p>放入大蒜炒香。</p>
    </section></body></html>`;
  const result=extractSourcePage(html,"https://mip.xiachufang.com/recipe/107725112/","xiachufang");
  assert.equal(result.title,"公瑾爆蛋");
  assert.deepEqual(result.extractedRecipe?.ingredients,[
    {name:"鸡蛋",amount:"6",unit:"个"},
    {name:"大蒜",amount:"2",unit:"瓣"},
  ]);
  assert.equal(result.extractedRecipe?.steps.length,2);
});

test("下厨房 107345578 式页面即使缺少用料标题也从结构化行读取食材",()=>{
  const html=`<html><head><title>【步骤图】可乐鸡翅的做法_可乐鸡翅的做法步骤_家常菜_下厨房</title></head><body>
    <section id="ings"><div class="recipe-ingredient">
      <a class="ing-line"><div class="ing-name">鸡翅</div><div class="ing-amount">500g</div></a>
      <a class="ing-line"><div class="ing-name">姜片</div><div class="ing-amount">5g</div></a>
      <a class="ing-line"><div class="ing-name">可乐</div><div class="ing-amount">300ml</div></a>
    </div></section><section><h3>可乐鸡翅的做法步骤</h3>
      <div>步骤 1</div><p>鲜鸡翅浸泡出血水，擦干水分。</p>
    </section></body></html>`;
  const result=extractSourcePage(html,"https://mip.xiachufang.com/recipe/107345578/","xiachufang");
  assert.equal(result.title,"可乐鸡翅");
  assert.deepEqual(result.extractedRecipe?.ingredients,[
    {name:"鸡翅",amount:"500",unit:"g"},
    {name:"姜片",amount:"5",unit:"g"},
    {name:"可乐",amount:"300",unit:"ml"},
  ]);
  assert.equal(result.extractedRecipe?.steps.length,1);
});

test("下厨房移动页 JSON-LD 的紧凑用料与编号步骤可完整拆分",()=>{
  const html=`<html><head><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Recipe","name":"可乐鸡翅","recipeIngredient":["500g鸡翅","5g姜片","300ml可乐"],"recipeInstructions":"0.浸泡鸡翅。,1.煎至两面金黄。,2.倒入可乐焖煮。"})}</script></head></html>`;
  const result=extractSourcePage(html,"https://m.xiachufang.com/recipe/107345578/","xiachufang");
  assert.deepEqual(result.extractedRecipe?.ingredients,[
    {name:"鸡翅",amount:"500",unit:"g"},
    {name:"姜片",amount:"5",unit:"g"},
    {name:"可乐",amount:"300",unit:"ml"},
  ]);
  assert.deepEqual(result.extractedRecipe?.steps,["浸泡鸡翅。","煎至两面金黄。","倒入可乐焖煮。"]);
  assert.equal(result.extractionMethod,"json_ld");
});

test("小红书页面正文可作为自动读取内容",()=>{
  const html=`<html><head><meta property="og:title" content="桃花酥 - 小红书"><meta property="og:description" content="用料：面粉 200克；黄油 80克 做法：1.混合面团 2.包馅烘烤"></head></html>`;
  const result=extractSourcePage(html,"https://www.xiaohongshu.com/explore/abc","xiaohongshu");
  assert.equal(result.title,"桃花酥");
  assert.ok(result.description.includes("面粉"));
});
