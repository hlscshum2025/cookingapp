import assert from "node:assert/strict";
import test from "node:test";

import { prepareBilibiliImport, recipeFromFavoriteVideo } from "../lib/bilibili.ts";

const sample = {
  favorite: { id: "3081759942", title: "做饭" },
  videos: [{
    bvid: "BV1TEST12345",
    title: "测试菜谱",
    video_url: "https://www.bilibili.com/video/BV1TEST12345",
    uploader: "测试 UP 主",
    cover_url: "http://i0.hdslb.com/test.jpg",
    intro: "只保存来源，不猜配方",
    duration_seconds: 61,
    published_at: "2026-06-15T06:32:41.000Z",
    favorited_at: "2026-07-31T04:51:21.000Z",
    invalid: false,
  }],
};

test("真实导出字段会完整规范化", () => {
  const prepared = prepareBilibiliImport(sample, "favorites.json");
  assert.equal(prepared.collectionId, "3081759942");
  assert.equal(prepared.videos.length, 1);
  assert.equal(prepared.skipped.length, 0);
  assert.deepEqual(prepared.videos[0], {
    bvid: "BV1TEST12345",
    title: "测试菜谱",
    url: "https://www.bilibili.com/video/BV1TEST12345",
    uploader: "测试 UP 主",
    description: "只保存来源，不猜配方",
    coverUrl: "https://i0.hdslb.com/test.jpg",
    durationSeconds: 61,
    publishedAt: "2026-06-15T06:32:41.000Z",
    favoritedAt: "2026-07-31T04:51:21.000Z",
    favoriteId: undefined,
    invalid: false,
    raw: sample.videos[0],
  });
});

test("来源视频只生成私密待整理菜谱，不编造食材与步骤", () => {
  const video = prepareBilibiliImport(sample).videos[0];
  const recipe = recipeFromFavoriteVideo(video);
  assert.equal(recipe.status, "inbox");
  assert.equal(recipe.visibility, "private");
  assert.deepEqual(recipe.ingredients, []);
  assert.deepEqual(recipe.steps, []);
  assert.equal(recipe.source?.durationSeconds, 61);
});
