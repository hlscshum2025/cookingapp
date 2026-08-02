import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const script = fs.readFileSync(new URL("../export-favorites.js", import.meta.url), "utf8");
const downloads = [];
const logs = [];
let pageCalls = 0;

const context = {
  window: { location: { search: "?fid=3081759942&ftype=create" } },
  URL,
  URLSearchParams,
  Blob,
  Date,
  setTimeout: (fn) => { fn(); return 1; },
  console: { log: (...args) => logs.push(args.join(" ")), error: (...args) => logs.push(args.join(" ")) },
  alert: (message) => { throw new Error(message); },
  document: {
    body: { appendChild() {} },
    createElement() {
      return { style: {}, addEventListener() {}, remove() {}, click() { downloads.push(this.download); } };
    },
  },
  fetch: async (url) => {
    pageCalls += 1;
    assert.match(url, /media_id=3081759942/);
    return {
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          info: { title: "吃饭", media_count: 2 },
          medias: pageCalls === 1 ? [
            { id: 1, bvid: "BV1TEST00001", title: "番茄炒蛋", upper: { name: "厨房UP", mid: 42 }, duration: 123, pubtime: 1700000000, fav_time: 1700001000, cover: "https://i.example/1.jpg", intro: "家常菜", type: 2, attr: 0 },
            { id: 2, bvid: "BV1TEST00002", title: "无麸质早餐", upper: { name: "厨房UP", mid: 42 }, duration: 99, pubtime: 1700002000, fav_time: 1700003000, cover: "https://i.example/2.jpg", intro: "燕麦做法", type: 2, attr: 0 },
          ] : [],
          has_more: false,
        },
      }),
    };
  },
};

context.window.window = context.window;
context.window.document = context.document;
context.window.URL = context.URL;
vm.createContext(context);
vm.runInContext(script, context);
await new Promise((resolve) => setImmediate(resolve));

const result = context.window.__COOKINGAPP_BILIBILI_EXPORT__;
assert.equal(result.favorite.id, "3081759942");
assert.equal(result.favorite.title, "吃饭");
assert.equal(result.video_count, 2);
assert.equal(result.videos[0].video_url, "https://www.bilibili.com/video/BV1TEST00001");
assert.deepEqual(downloads, ["吃饭-2026-08-02.json"]);
assert.ok(logs.some((line) => line.includes("导出完成：2 条")));
console.log("export-favorites test passed");
