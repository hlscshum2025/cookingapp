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

  function showSavePanel(filename, jsonText, count) {
    document.getElementById("cookingapp-export-panel")?.remove();

    const panel = document.createElement("div");
    panel.id = "cookingapp-export-panel";
    Object.assign(panel.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "2147483647",
      width: "320px",
      padding: "18px",
      borderRadius: "12px",
      background: "#ffffff",
      color: "#18191c",
      boxShadow: "0 8px 32px rgba(0,0,0,.28)",
      font: "14px/1.6 system-ui, sans-serif",
    });

    const title = document.createElement("strong");
    title.textContent = `CookingApp：已提取 ${count} 条`;
    title.style.display = "block";
    title.style.marginBottom = "8px";

    const tip = document.createElement("div");
    tip.textContent = "请点击下面的按钮，在 Edge 弹出的窗口中保存 JSON。";
    tip.style.marginBottom = "12px";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "保存 JSON 文件";
    Object.assign(saveButton.style, {
      width: "100%",
      padding: "10px 14px",
      border: "0",
      borderRadius: "8px",
      background: "#00aeec",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "700",
    });

    const status = document.createElement("div");
    status.style.marginTop = "10px";
    status.style.fontSize = "12px";

    saveButton.addEventListener("click", async () => {
      try {
        if (!window.showSaveFilePicker) {
          throw new Error("当前浏览器不支持直接另存为，请使用最新版 Edge 或 Chrome。");
        }
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: "JSON 文件",
            accept: { "application/json": [".json"] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonText);
        await writable.close();
        status.textContent = `保存成功：${filename}`;
        status.style.color = "#00843d";
      } catch (error) {
        if (error?.name === "AbortError") {
          status.textContent = "已取消保存；需要时可以再次点击按钮。";
          status.style.color = "#61666d";
          return;
        }
        status.textContent = error.message;
        status.style.color = "#d00";
        console.error("[CookingApp] 保存失败：", error);
      }
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "关闭";
    Object.assign(closeButton.style, {
      marginTop: "8px",
      width: "100%",
      padding: "7px",
      border: "1px solid #c9ccd0",
      borderRadius: "8px",
      background: "#fff",
      cursor: "pointer",
    });
    closeButton.addEventListener("click", () => panel.remove());

    panel.append(title, tip, saveButton, closeButton, status);
    document.body.appendChild(panel);
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
    const filename = `${safeTitle}-${date}.json`;
    const jsonText = JSON.stringify(payload, null, 2);
    // 不再创建或点击 blob: 链接；B 站会把它错误地当成站内导航。
    // 改为显示保存按钮，由用户点击后调用浏览器原生“另存为”窗口。
    window.__COOKINGAPP_BILIBILI_EXPORT__ = payload;
    showSavePanel(filename, jsonText, videos.length);
    console.log(`[CookingApp] 导出完成：${videos.length} 条。请点击页面右上角的“保存 JSON 文件”。`);
  } catch (error) {
    console.error("[CookingApp] 导出失败：", error);
    alert(`导出失败：${error.message}\n\n请确认：\n1. 已登录 B 站；\n2. 当前打开的是目标收藏夹；\n3. 页面可以正常显示收藏内容。`);
  }
})();
