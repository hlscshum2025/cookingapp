/**
 * Bilibili 收藏夹本地导出工具
 *
 * 使用方法：登录 B 站并打开目标收藏夹，在浏览器开发者工具的 Console
 * 中粘贴本文件的全部内容并回车。数据只在当前浏览器中处理。
 */
(async () => {
  "use strict";

  const CONFIG = {
    pageSize: 20,
    requestDelayMs: 350,
    maxPages: 100,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function getFavoriteId() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("fid") || params.get("media_id");
    if (!id || !/^\d+$/.test(id)) {
      throw new Error("没有在当前网址中找到收藏夹 fid。请先打开目标收藏夹页面。");
    }
    return id;
  }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function formatDate(unixSeconds) {
    if (!unixSeconds) return "";
    return new Date(unixSeconds * 1000).toISOString();
  }

  function normalize(item, index, favoriteId) {
    const bvid = item.bvid || "";
    return {
      index: index + 1,
      favorite_id: String(favoriteId),
      id: item.id ?? "",
      bvid,
      title: item.title || "",
      video_url: bvid ? `https://www.bilibili.com/video/${bvid}` : "",
      uploader: item.upper?.name || "",
      uploader_mid: item.upper?.mid ?? "",
      duration_seconds: item.duration ?? "",
      published_at: formatDate(item.pubtime),
      favorited_at: formatDate(item.fav_time),
      cover_url: item.cover || "",
      intro: item.intro || "",
      media_type: item.type ?? "",
      invalid: Boolean(item.attr && (item.attr & 9)),
    };
  }

  async function fetchPage(favoriteId, page) {
    const query = new URLSearchParams({
      media_id: favoriteId,
      pn: String(page),
      ps: String(CONFIG.pageSize),
      keyword: "",
      order: "mtime",
      type: "0",
      tid: "0",
      platform: "web",
    });
    const response = await fetch(`https://api.bilibili.com/x/v3/fav/resource/list?${query}`, {
      credentials: "include",
      headers: { Accept: "application/json, text/plain, */*" },
    });
    if (!response.ok) {
      throw new Error(`第 ${page} 页请求失败：HTTP ${response.status}`);
    }
    const body = await response.json();
    if (body.code !== 0) {
      throw new Error(`第 ${page} 页请求失败：${body.message || body.code}`);
    }
    return body.data || {};
  }

  function download(filename, content, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener";
    link.style.display = "none";
    // B 站是单页应用，必须阻止它的全局链接处理器截获这个下载点击，
    // 否则当前收藏夹网址可能被错误拼接并跳走。
    link.addEventListener("click", (event) => event.stopImmediatePropagation());
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toCsv(items) {
    const columns = [
      "index", "favorite_id", "id", "bvid", "title", "video_url",
      "uploader", "uploader_mid", "duration_seconds", "published_at",
      "favorited_at", "cover_url", "intro", "media_type", "invalid",
    ];
    const rows = [columns.map(csvCell).join(",")];
    for (const item of items) {
      rows.push(columns.map((column) => csvCell(item[column])).join(","));
    }
    return `\uFEFF${rows.join("\r\n")}`;
  }

  try {
    const favoriteId = getFavoriteId();
    const collected = [];
    let favoriteTitle = "bilibili-favorites";
    let expectedCount = null;

    console.log(`[CookingApp] 开始导出收藏夹 ${favoriteId}…`);
    for (let page = 1; page <= CONFIG.maxPages; page += 1) {
      const data = await fetchPage(favoriteId, page);
      const medias = Array.isArray(data.medias) ? data.medias : [];
      if (data.info?.title) favoriteTitle = data.info.title;
      if (Number.isFinite(data.info?.media_count)) expectedCount = data.info.media_count;
      collected.push(...medias);
      console.log(`[CookingApp] 已读取 ${collected.length}${expectedCount == null ? "" : ` / ${expectedCount}`} 条`);

      if (data.has_more === false || medias.length === 0 || (expectedCount != null && collected.length >= expectedCount)) break;
      await sleep(CONFIG.requestDelayMs);
    }

    const seen = new Set();
    const unique = collected.filter((item) => {
      const key = item.bvid || String(item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const videos = unique.map((item, index) => normalize(item, index, favoriteId));
    const exportedAt = new Date().toISOString();
    const payload = {
      schema_version: "1.0",
      source: "bilibili-favorites-exporter",
      favorite: { id: String(favoriteId), title: favoriteTitle, expected_count: expectedCount },
      exported_at: exportedAt,
      video_count: videos.length,
      videos,
    };
    const safeTitle = favoriteTitle.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-|-$/g, "") || "favorites";
    const date = exportedAt.slice(0, 10);
    // 只触发一次自动下载，避免 Edge 拦截“多个自动下载”。JSON 是
    // CookingApp 后续导入所需的完整原始文件；CSV 可在之后从 JSON 生成。
    download(`${safeTitle}-${date}.json`, JSON.stringify(payload, null, 2), "application/json");
    console.log(`[CookingApp] 导出完成：${videos.length} 条。已下载 JSON 文件。`);
    window.__COOKINGAPP_BILIBILI_EXPORT__ = payload;
  } catch (error) {
    console.error("[CookingApp] 导出失败：", error);
    alert(`导出失败：${error.message}\n\n请确认：\n1. 已登录 B 站；\n2. 当前打开的是目标收藏夹；\n3. 页面可以正常显示收藏内容。`);
  }
})();
