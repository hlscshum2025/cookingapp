"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { prepareBilibiliImport, type PreparedBilibiliImport } from "@/lib/bilibili";
import { useCooking } from "@/components/CookingProvider";
import { ManualRecipeEntry } from "@/components/ManualRecipeEntry";
import type { ImportResult } from "@/lib/types";

type WorkspaceMode="source"|"json"|"automatic";

function durationLabel(seconds?:number){
  if(!seconds)return "时长未知";
  const minutes=Math.floor(seconds/60);
  return `${minutes}:${String(seconds%60).padStart(2,"0")}`;
}

export default function ImportsPage(){
  const {recipes,importJobs,sourceVideos,isDemo,cloudStatus,importVideos}=useCooking();
  const [mode,setMode]=useState<WorkspaceMode>("source");
  const [selectedId,setSelectedId]=useState("");
  const [search,setSearch]=useState("");
  const [manualOpen,setManualOpen]=useState(false);
  const [videoCollapsed,setVideoCollapsed]=useState(false);
  const [prepared,setPrepared]=useState<PreparedBilibiliImport|null>(null);
  const [scope,setScope]=useState<"ten"|"all">("ten");
  const [error,setError]=useState("");
  const [result,setResult]=useState<ImportResult|null>(null);
  const [busy,setBusy]=useState(false);

  const existing=useMemo(()=>new Set(recipes.map(recipe=>recipe.source?.bvid).filter(Boolean)),[recipes]);
  const filteredVideos=useMemo(()=>{
    const query=search.trim().toLowerCase();
    if(!query)return sourceVideos;
    return sourceVideos.filter(video=>[video.title,video.externalId,video.uploaderName].some(value=>value.toLowerCase().includes(query)));
  },[search,sourceVideos]);
  const selected=sourceVideos.find(video=>video.id===selectedId)??sourceVideos[0];
  const selectedVideos=prepared?.videos.slice(0,scope==="ten"?10:undefined)||[];
  const duplicates=selectedVideos.filter(video=>existing.has(video.bvid)).length;

  const chooseVideo=(id:string)=>{setSelectedId(id);setManualOpen(false);setVideoCollapsed(false);};
  const startManual=()=>{if(selected){setManualOpen(true);setVideoCollapsed(false);window.setTimeout(()=>document.getElementById("manual-workspace")?.scrollIntoView({behavior:"smooth"}),0);}};
  const pick=async(file?:File)=>{if(!file)return;setError("");setResult(null);try{setPrepared(prepareBilibiliImport(JSON.parse(await file.text()),file.name));}catch(reason){setPrepared(null);setError(reason instanceof Error?reason.message:"JSON 读取失败");}};
  const confirm=async()=>{if(!prepared)return;setBusy(true);setError("");try{const next=await importVideos(selectedVideos,{collectionId:prepared.collectionId,fileName:prepared.fileName,skipped:scope==="all"?prepared.skipped.length:0});setResult(next);setMode("source");}catch(reason){setError(reason instanceof Error?reason.message:"导入失败");}finally{setBusy(false);}};
  const connectionNotice=cloudStatus==="unconfigured"?<> <b>Supabase 尚未配置：不会收到任何数据。</b></>:cloudStatus==="signed_out"?<> <b>CookingApp 尚未登录。</b> 请先 <Link href="/login"><u>完成邮箱登录</u></Link>。</>:cloudStatus==="error"?<> <b>Supabase 连接异常。</b> 请到“设置”查看详情。</>:null;

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">IMPORT WORKSPACE</p><h1>导入中心</h1><p className="subtitle">从 JSON 来源到原视频，再到手工录入和保存，一条连续流程完成。</p></div><span className="badge">{sourceVideos.length} 条来源视频</span></header>
    {connectionNotice&&<div className="notice" style={{marginBottom:18,background:"#fff1cc",color:"#6d4d00"}}>{connectionNotice}</div>}

    <nav className="import-mode-nav" aria-label="导入方式">
      <button className={mode==="source"?"active":""} onClick={()=>setMode("source")}><b>1</b><span>来源视频与手工录入<small>本版推荐流程</small></span></button>
      <button className={mode==="json"?"active":""} onClick={()=>setMode("json")}><b>2</b><span>导入 JSON<small>加入来源视频库</small></span></button>
      <button className={mode==="automatic"?"active":""} onClick={()=>setMode("automatic")}><b>3</b><span>一键自动导入<small>第三版再完善</small></span></button>
    </nav>

    {mode==="source"&&<>
      {sourceVideos.length?<div className="source-workspace">
        <aside className="panel source-browser">
          <div className="section-head" style={{marginTop:0}}><h2>来源视频</h2><span className="badge">{filteredVideos.length}</span></div>
          <input className="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索标题、BV号或UP主" aria-label="搜索来源视频"/>
          <div className="source-video-list">{filteredVideos.map(video=><button key={video.id} className={selected?.id===video.id?"active":""} onClick={()=>chooseVideo(video.id)}>
            <span className="source-thumb">{video.coverUrl?<span className="source-thumb-image" style={{backgroundImage:`url(${JSON.stringify(video.coverUrl)})`}}/>:"▶"}</span>
            <span><strong>{video.title}</strong><small>{video.externalId} · {video.uploaderName||"UP主未知"}</small></span>
          </button>)}</div>
        </aside>
        {selected&&<section className={`source-review ${manualOpen?"floating-active":""}`}>
          <div className={`panel source-review-card ${manualOpen?"is-floating":""} ${videoCollapsed?"is-collapsed":""}`}>
            {manualOpen&&<div className="floating-video-head"><b>边看边录：{selected.title}</b><button type="button" onClick={()=>setVideoCollapsed(value=>!value)}>{videoCollapsed?"显示视频":"收起视频"}</button></div>}
            <div className="video-frame"><iframe key={selected.externalId} title={`B站视频：${selected.title}`} src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(selected.externalId)}&high_quality=1`} allowFullScreen/></div>
            <div className="source-detail-head"><div><p className="eyebrow">{selected.externalId}</p><h2>{selected.title}</h2><p className="subtitle">{selected.uploaderName||"UP主未知"} · {durationLabel(selected.durationSeconds)}</p></div><span className={`badge ${selected.availability==="available"?"":"warn"}`}>{selected.availability==="available"?"可访问":"需核验"}</span></div>
            {selected.description&&<p className="source-description">{selected.description}</p>}
            <div className="source-actions"><a className="btn btn-secondary" href={selected.url} target="_blank" rel="noreferrer">在 B 站打开原视频 ↗</a><button className="btn btn-primary" onClick={startManual}>一键进入手动录入 →</button></div>
            <div className="notice" style={{marginTop:16}}>视频仍由 B 站提供，CookingApp 只保存链接与来源信息。进入手动录入后会自动带入 BV号、标题、UP主和链接。</div>
          </div>
        </section>}
      </div>:<div className="panel empty"><span>▶</span><h2>来源视频库还是空的</h2><p>先切换到“导入 JSON”，把公开视频元数据加入 `source_videos`；视频文件不会被下载。</p><button className="btn btn-primary" onClick={()=>setMode("json")}>去导入 JSON</button></div>}
      {manualOpen&&selected&&<section id="manual-workspace" className="manual-workspace-section">
        <div className="section-head"><div><p className="eyebrow">MANUAL ENTRY</p><h2>手动录入：{selected.title}</h2></div><button className="btn btn-secondary" onClick={()=>setManualOpen(false)}>收起录入区</button></div>
        <ManualRecipeEntry key={selected.id} initialSource={selected}/>
      </section>}
    </>}

    {mode==="json"&&<div className="two-col"><section className="panel">
      <h2>1. 选择 B 站收藏夹 JSON</h2><div className="dropzone"><div style={{fontSize:44}}>⇩</div><b>选择“做饭-日期.json”</b><p className="subtitle">文件只含公开视频元数据，不含 Cookie 或视频文件</p><input type="file" accept="application/json,.json" onChange={event=>pick(event.target.files?.[0])}/></div>
      {error&&<div className="notice" role="alert" style={{marginTop:14,background:"#fbe5de",color:"#923c29"}}>读取失败：{error}</div>}
      {prepared&&<><div className="section-head"><h2>2. 导入预览</h2><span className="badge">{prepared.fileName}</span></div><div className="field" style={{marginBottom:16}}><label>本次导入范围</label><select value={scope} onChange={event=>setScope(event.target.value as "ten"|"all")}><option value="ten">先试导入前 10 条（推荐）</option><option value="all">导入全部 {prepared.videos.length} 条</option></select></div><div className="stats import-stats"><div className="stat"><div className="stat-label">本次处理</div><div className="stat-value">{selectedVideos.length}</div></div><div className="stat"><div className="stat-label">预计新增</div><div className="stat-value">{selectedVideos.length-duplicates}</div></div><div className="stat"><div className="stat-label">重复</div><div className="stat-value">{duplicates}</div></div><div className="stat"><div className="stat-label">无效</div><div className="stat-value">{prepared.skipped.length}</div></div></div><div className="source-preview-list">{selectedVideos.slice(0,12).map(video=><div key={video.bvid}><b>{video.title}</b><span>{video.bvid} · {video.uploader||"UP主未知"}</span></div>)}</div><div className="notice" style={{marginTop:14}}>JSON 只建立来源视频库，不会猜测配料克数、火候或步骤。导入后请从来源列表选择视频并手工录入。</div><button className="btn btn-primary" style={{marginTop:17}} onClick={confirm} disabled={busy}>{busy?"正在写入来源视频库…":`确认导入 ${selectedVideos.length} 条`}</button></>}
      {result&&<div className="notice" style={{marginTop:14,background:"var(--leaf-soft)",color:"var(--leaf)"}}><b>{result.mode==="cloud"?"云端导入完成":"本机演示导入完成"}</b><br/>新增 {result.added}，重复 {result.duplicates}，失败 {result.failed}，跳过 {result.skipped}。现在可以回到来源视频列表继续手工录入。</div>}
    </section><aside className="panel"><h2>导入审计记录</h2><p className="subtitle">{isDemo?"当前未登录。":"记录来自 Supabase。"}</p>{importJobs.length?<div className="source-list">{importJobs.slice(0,8).map(job=><div key={job.id} style={{padding:"12px 0",borderBottom:"1px solid var(--line)"}}><b>{job.fileName||"B站收藏夹导入"}</b><small style={{display:"block",marginTop:4}}>{new Date(job.createdAt).toLocaleString("zh-CN")} · 新增 {job.added} / 重复 {job.duplicates} / 失败 {job.failed}</small></div>)}</div>:<p className="subtitle">还没有导入任务。</p>}</aside></div>}

    {mode==="automatic"&&<section className="panel automatic-placeholder"><span>✦</span><p className="eyebrow">PLANNED FOR V3</p><h2>一键自动导入暂时保留入口</h2><p className="subtitle">以后可以在这里加入字幕解析、画面 OCR、食材与步骤识别和批量审核。第二版不依赖它，先把“打开原视频＋人工确认”做稳定。</p><button className="btn btn-primary" onClick={()=>setMode("source")}>返回手工录入主流程</button></section>}
  </div>;
}
