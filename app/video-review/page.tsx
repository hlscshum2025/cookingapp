"use client";

import { useMemo, useState } from "react";
import {
  parseBilibiliSubtitleExport,
  sampleCandidateRecipes,
  type SubtitleReviewDocument,
} from "@/lib/video-review";

const sampleVideos = [
  { bvid: "BV1CQ4y1j7or", label: "馒头样本" },
  { bvid: "BV1JmbVzfEev", label: "三款酸奶酱样本" },
];

function timeLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function VideoReviewPage() {
  const [bvid, setBvid] = useState(sampleVideos[0].bvid);
  const [subtitle, setSubtitle] = useState<SubtitleReviewDocument | null>(null);
  const [error, setError] = useState("");
  const candidates = useMemo(
    () => sampleCandidateRecipes.filter((recipe) => recipe.bvid === bvid),
    [bvid],
  );
  const cues = subtitle?.video.bvid === bvid ? subtitle.tracks[0]?.cues ?? [] : [];

  const importSubtitle = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const parsed = parseBilibiliSubtitleExport(JSON.parse(await file.text()));
      setSubtitle(parsed);
      setBvid(parsed.video.bvid);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "字幕 JSON 读取失败。");
    }
  };

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">VIDEO REVIEW</p><h1>视频内容审核</h1><p className="subtitle">播放器、带时间字幕和候选来源菜谱放在同一页；字幕没有说、画面没有写的字段保持待核验。</p></div></header>
    <div className="search-panel">
      <label className="field" style={{minWidth:240}}><span>样本视频</span><select value={bvid} onChange={(event)=>setBvid(event.target.value)}>{sampleVideos.map((video)=><option key={video.bvid} value={video.bvid}>{video.label} · {video.bvid}</option>)}</select></label>
      <label className="field" style={{minWidth:280}}><span>导入在 B 站页面导出的字幕 JSON</span><input type="file" accept="application/json,.json" onChange={(event)=>importSubtitle(event.target.files?.[0])}/></label>
    </div>
    {error&&<div className="notice" style={{marginBottom:16,background:"#fbe5de",color:"#923c29"}}>读取失败：{error}</div>}
    <div className="two-col">
      <section className="panel">
        <div style={{aspectRatio:"16 / 9",borderRadius:16,overflow:"hidden",background:"#171717"}}><iframe title="B站视频播放器" src={`https://player.bilibili.com/player.html?bvid=${bvid}&high_quality=1`} allowFullScreen style={{border:0,width:"100%",height:"100%"}}/></div>
        <div className="section-head"><h2>时间轴字幕</h2><span className={`badge ${cues.length?"":"warn"}`}>{cues.length ? `${cues.length} 句` : "等待导入"}</span></div>
        {cues.length?<ol className="step-list">{cues.map((cue,index)=><li className="step-item" key={`${cue.from}-${index}`}><span className="step-no">{timeLabel(cue.from)}</span><p>{cue.text}</p></li>)}</ol>:<div className="empty"><span>字幕</span><p>先在已登录的 B 站视频页运行仓库里的字幕导出工具，再把 JSON 放到这里。</p></div>}
      </section>
      <aside className="panel">
        <h2>候选来源版</h2>
        <p className="subtitle">当前样本拆成 {candidates.length} 份独立配方。这里不会保存你的个人修改版。</p>
        {candidates.map((recipe)=><article key={recipe.id} style={{padding:"16px 0",borderBottom:"1px solid var(--line)"}}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><b>{recipe.title}</b><span className={`badge ${recipe.reviewStatus==="ready_for_review"?"":"warn"}`}>{recipe.reviewStatus==="ready_for_review"?"可审核":"待补证据"}</span></div><small>{recipe.section}</small>{recipe.ingredients.length>0&&<ul className="ingredient-list" style={{marginTop:8}}>{recipe.ingredients.map((item)=><li key={item.name}><span>{item.name}</span><b>{item.amount} {item.unit}</b></li>)}</ul>}<div className="notice" style={{marginTop:10}}>{recipe.missing.join("；")}</div></article>)}
      </aside>
    </div>
  </div>;
}
