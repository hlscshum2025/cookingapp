import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { calculateRecipeCost, convertAmount } from "../lib/costing.ts";
import { groupIngredientTranslations } from "../lib/ingredient-sourcing.ts";
import { parseBilibiliSubtitleExport, sampleCandidateRecipes } from "../lib/video-review.ts";

test("字幕导出 JSON 会规范化时间轴和 AI 标记", () => {
  const parsed = parseBilibiliSubtitleExport({
    video: { bvid: "BV1CQ4y1j7or", cid: 123, title: "测试" },
    tracks: [{ lan: "ai-zh", lan_doc: "中文（AI生成）", body: [{ from: 1.2, to: 2.8, content: "加入面粉" }] }],
  });
  assert.equal(parsed.video.bvid, "BV1CQ4y1j7or");
  assert.equal(parsed.tracks[0].isAi, true);
  assert.deepEqual(parsed.tracks[0].cues[0], { from: 1.2, to: 2.8, text: "加入面粉" });
});

test("两个样本拆成四份候选来源菜谱且不猜酸奶酱克数", () => {
  assert.equal(sampleCandidateRecipes.length, 4);
  assert.equal(sampleCandidateRecipes[0].ingredients.length, 6);
  assert.equal(sampleCandidateRecipes.filter((recipe) => recipe.bvid === "BV1JmbVzfEev").every((recipe) => recipe.ingredients.length === 0), true);
});

test("翻译词条按德国普通超市和亚超分区", () => {
  const grouped = groupIngredientTranslations();
  assert.ok(grouped.germanSupermarket.some((item) => item.de === "Filet"));
  assert.ok(grouped.germanSupermarket.some((item) => item.de === "Dattel"));
  assert.ok(grouped.asianMarket.some((item) => item.zh === "生抽"));
});

test("成本核算支持单位换算、按次数均摊和每人份", () => {
  assert.equal(convertAmount(1, "kg", "g"), 1000);
  const result = calculateRecipeCost([
    { id:"flour",name:"面粉",purchasePrice:2,currency:"EUR",packageAmount:1,packageUnit:"kg",allocation:{mode:"quantity",usedAmount:500,usedUnit:"g"} },
    { id:"salt",name:"盐",purchasePrice:1,currency:"EUR",allocation:{mode:"uses",estimatedUses:100} },
  ], 2);
  assert.equal(result.total, 1.01);
  assert.equal(result.perServing, 0.505);
  assert.equal(result.estimated, true);
});

test("不同维度单位不会被错误相加", () => {
  assert.throws(() => convertAmount(100, "g", "ml"), /单位不兼容/);
});

test("导航已经接入视频审核、翻译采购与成本核算", async () => {
  const source = await readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8");
  assert.match(source, /\/video-review/);
  assert.match(source, /\/translations/);
  assert.match(source, /\/costs/);
});
