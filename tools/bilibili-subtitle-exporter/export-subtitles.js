/*
 * 在已登录的 B 站视频页面控制台中运行。
 * 只读取当前视频可用的字幕轨道并下载 JSON；不会导出 Cookie、账号或收藏数据。
 */
(async () => {
  const bvid = location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1];
  if (!bvid) throw new Error("请先打开一个 B 站视频详情页。");

  const state = window.__INITIAL_STATE__ || {};
  let cid = state.videoData?.cid || state.cid;
  if (!cid) {
    const pageResponse = await fetch(`/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`, { credentials: "include" });
    const pagePayload = await pageResponse.json();
    cid = pagePayload?.data?.[0]?.cid;
  }
  if (!cid) throw new Error("没有找到当前视频的 cid。");

  const playerResponse = await fetch(`/x/player/v2?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}`, { credentials: "include" });
  const playerPayload = await playerResponse.json();
  const available = playerPayload?.data?.subtitle?.subtitles || [];
  if (!available.length) throw new Error("当前登录状态下没有返回可用字幕轨道。");

  const tracks = [];
  for (const track of available) {
    const subtitleUrl = String(track.subtitle_url || "").replace(/^\/\//, "https://");
    if (!subtitleUrl) continue;
    const subtitleResponse = await fetch(subtitleUrl, { credentials: "include" });
    const subtitlePayload = await subtitleResponse.json();
    tracks.push({
      id: String(track.id ?? track.subtitle_id ?? tracks.length),
      language: track.lan || "unknown",
      label: track.lan_doc || track.lan || "字幕",
      isAi: track.ai_status === 1 || /AI|智能/i.test(track.lan_doc || ""),
      cues: (subtitlePayload.body || []).map((cue) => ({
        from: Number(cue.from),
        to: Number(cue.to),
        text: String(cue.content || "").trim(),
      })).filter((cue) => cue.text && Number.isFinite(cue.from) && Number.isFinite(cue.to)),
    });
  }

  const payload = {
    schemaVersion: "cookingapp-bilibili-subtitle-1",
    exportedAt: new Date().toISOString(),
    video: {
      bvid,
      cid: Number(cid),
      title: document.title.replace(/_哔哩哔哩_bilibili$/, "").trim(),
      url: location.href.split("?")[0],
    },
    tracks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${bvid}-subtitles.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  console.info(`CookingApp：已导出 ${tracks.length} 条字幕轨道。`);
})();

