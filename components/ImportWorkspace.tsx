"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { prepareBilibiliImport, type PreparedBilibiliImport } from "@/lib/bilibili";
import { useCooking } from "@/components/CookingProvider";
import { ManualRecipeEntry } from "@/components/ManualRecipeEntry";
import { discardPendingSourceVideo, loadPendingSourceVideos } from "@/lib/source-videos";
import type { ImportResult, SourceVideo } from "@/lib/types";

type WorkspaceMode="source"|"json"|"automatic";
const exporterUrl="https://github.com/hlscshum2025/cookingapp/blob/main/tools/bilibili-favorites-exporter/export-favorites.js";

function durationLabel(seconds?:number){
  if(!seconds)return "时长未知";
  const minutes=Math.floor(seconds/60);
  return `${minutes}:${String(seconds%60).padStart(2,"0")}`;
}

export function ImportWorkspace(){
  const {sourceVideos,importJobs,isDemo,cloudStatus,importVideos}=useCooking();
  const [mode,setMode]=useState<WorkspaceMode>("source");
  const [pendingVideos,setPendingVideos]=useState<SourceVideo[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [search,setSearch]=useState("");
  const [manualOpen,setManualOpen]=useState(false);
  const [videoCollapsed,setVideoCollapsed]=useState(false);
  const [prepared,setPrepared]=useState<PreparedBilibiliImport|null>(null);
  const [scope,setScope]=useState<"ten"|"all">("ten");
  const [error,setError]=useState("");
  const [result,setResult]=useState<ImportResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [deleting,setDeleting]=useState(false);

  const refreshPending=useCallback(async()=>{
    if(cloudStatus!=="connected"){setPendingVideos([]);return;}
    try{
      const rows=await loadPendingSourceVideos();
      setPendingVideos(rows);
      setSelectedId(current=>rows.some(video=>video.id===current)?current:(rows[0]?.id||""));
    }catch(reason){
      setError(reason instanceof Error?reason.message:"来源视频读取失败。");
    }
  },[cloudStatus]);

  useEffect(()=>{void refreshPending();},[refreshPending]);

  const existing=useMemo(()=>new Set(sourceVideos.filter(video=>video.platform==="bilibili").map(video=>video.externalId)),[sourceVideos]);
  const filteredVideos=useMemo(()=>{
    const query=search.trim().toLowerCase();
    if(!query)return pendingVideos;
    return pendingVideos.filter(video=>[video.title,video.externalId,video.uploaderName].some(value=>value.toLowerCase().includes(query)));
  },[search,pendingVideos]);
  const selected=pendingVideos.find(video=>video.id===selectedId)??pendingVideos[0];
  const selectedVideos=prepared?.videos.slice(0,scope==="ten"?10:undefined)||[];
  const duplicates=selectedVideos.filter(video=>existing.has(video.bvid)).length;

  const chooseVideo=(id:string)=>{setSelectedId(id);setManualOpen(false);setVideoCollapsed(false);};
  const startManual=()=>{if(selected){setManualOpen(true);setVideoCollapsed(false);window.setTimeout(()=>document.getElementById("manual-workspace")?.scrollIntoView({behavior:"smooth"}),0);}};
  const pick=async(file?:File)=>{if(!file)return;setError("");setResult(null);try{setPrepared(prepareBilibiliImport(JSON.parse(await file.text()),file.name));}catch(reason){setPrepared(null);setError(reason instanceof Error?reason.message:"JSON 读取失败");}};
  const confirm=async()=>{
    if(!prepared)return;
    setBusy(true);setError("");
    try{
      const next=await importVideos(selectedVideos,{collectionId:prepared.collectionId,fileName:prepared.fileName,skipped:scope==="all"?prepared.skipped.length:0});
      setResult(next);setMode("source");
      await refreshPending();
    }catch(reason){setError(reason instanceof Error?reason.message:"导入失败");}
    finally{setBusy(false);}
  };
  const deleteSelected=async()=>{
    if(!selected)return;
    if(!window.confirm(`确认从 CookingApp 来源待办中删除“${selected.title}”吗？\n\n这只删除 CookingApp 保存的来源元数据，不会删除 B 站原视频。以后再次导入同一收藏夹时，它仍可以重新进入待处理列表。`))return;
    setDeleting(true);setError("");
    try{
      await discardPendingSourceVideo(selected.id);
      setManualOpen(false);
      await refreshPending();
    }catch(reason){setError(reason instanceof Error?reason.message:"来源删除失败。");}
    finally{setDeleting(false);}
  };

  const connectionNotice=cloudStatus==="unconfigured"?<> <b>Supabase 尚未配置：不会收到任何数据。</b></>:cloudStatus==="signed_out"?<> <b>CookingApp 尚未登录。</b> 请先 <Link href="/login"><u>完成邮箱登录</u></Link>。</>:cloudStatus==="error"?<> <b>Supabase 连接异常。</b> 请到“设置”查看详情。</>:null;

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">IMPORT WORKSPACE</p><h1>导入中心</h1><p className="subtitle">JSON 只创建来源待办，不创建菜谱。手工整理并保存后才进入菜谱库；不需要的视频可以直接从待办中删除。</p></div><span className="badge">{pendingVideos.length} 条待处理</span></header>
    {connectionNotice&&<div className="notice" style={{marginBottom:18,background:"#fff1cc",color:"#6d4d00"}}>{connectionNotice}</div>}
    {error&&<div className="notice" role="alert" style={{marginBottom:18,background:"#fbe5de",color:"#923c29"}}>{error}</div>}

    <nav className="import-mode-nav" aria-label="导入方式">
      <button className={mode==="source"?"active":""} onClick={()=>setMode("source")}><b>1</b><span>待处理来源与手工录入<small>保存菜谱后自动移出</small></span></button>
      <button className={mode==="json"?"active":""} onClick={()=>setMode("json")}><b>2</b><span>导入 JSON<small>只加入来源待办</small></span></button>
      <button className={mode==="automatic"?"active":""} onClick={()=>setMode("automatic")}><b>3</b><span>一键自动导入<small>第三版再完善</small></span></button>
    </nav>

    {mode==="source"&&<>
      {pendingVideos.length?<div className="source-workspace">
        <aside className="panel source-browser">
          <div className="section-head" style={{marginTop:0}}><h2>待处理来源</h2><span className="badge">{filteredVideos.length}</span></div>
          <input className="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索标题、BV号或UP主" aria-label="搜索待处理来源视频"/>
          <div className="source-video-list">{filteredVideos.map(video=><button key={video.id} className={selected?.id===video.id?"active":""} onClick={()=>chooseVideo(video.id)}>
            <span className="source-thumb">{video.coverUrl?<span className="source-thumb-image" style={{backgroundImage:`url(${JSON.stringify(video.coverUrl)})`}}/>:"▶"}</span>
            <span><strong>{video.title}</strong><small>{video.externalId} · {video.uploaderName||"UP主未知"}</small></span>
          </button>)}</div>
        </aside>
        {selected&&<section className={`source-review ${manualOpen?"floating-active":""}`}>
          <div className={`panel source-review-card ${manualOpen?"is-floating":""} ${videoCollapsed?"is-collapsed":""}`}>
            {manualOpen&&<div className="floating-video-head"><b>边看边录：{selected.title}</b><button type="button" onClick={()=>setVideoCollapsed(value=>!value)}>{videoCollapsed?"显示视频":"收起视频"}</button></div>}
            <div className="video-frame" style={{maxWidth:920,marginInline:"auto"}}><iframe key={selected.externalId} title={`B站视频：${selected.title}`} src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(selected.externalId)}&high_quality=1&autoplay=0&danmaku=0`} allow="fullscreen; picture-in-picture" allowFullScreen/></div>
            <div className="source-detail-head"><div><p className="eyebrow">{selected.externalId}</p><h2>{selected.title}</h2><p className="subtitle">{selected.uploaderName||"UP主未知"} · {durationLabel(selected.durationSeconds)}</p></div><span className={`badge ${selected.availability==="available"?"":"warn"}`}>{selected.availability==="available"?"可访问":"需核验"}</span></div>
            {selected.description&&<p className="source-description">{selected.description}</p>}
            <div className="source-actions" style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="btn btn-primary" onClick={startManual}>进入手动录入 →</button>
              <button className="btn btn-danger" onClick={deleteSelected} disabled={deleting}>{deleting?"正在删除…":"删除这个来源"}</button>
            </div>
            <div className="notice" style={{marginTop:16}}>保存手工菜谱后，对应来源会自动标记完成并从这里移出；菜谱仍保存原视频链接和 UP 主信息。如果这个视频不需要整理，可以直接删除这条来源待办。</div>
          </div>
        </section>}
      </div>:<div className="panel empty"><span>✓</span><h2>待处理来源已经清空</h2><p>已经保存成菜谱的来源会自动离开这里；不需要的来源可以删除。需要新增来源时继续导入 JSON 即可。</p><button className="btn btn-primary" onClick={()=>setMode("json")}>继续导入 JSON</button></div>}
      {manualOpen&&selected&&<section id="manual-workspace" className="manual-workspace-section">
        <div className="section-head"><div><p className="eyebrow">MANUAL ENTRY</p><h2>手动录入：{selected.title}</h2><p className="subtitle">正式保存菜谱后，这条来源会自动标记完成；只有保存成功的菜谱才会进入菜谱库。</p></div><button className="btn btn-secondary" onClick={()=>setManualOpen(false)}>收起录入区</button></div>
        <ManualRecipeEntry key={selected.id} initialSource={selected}/>
      </section>}
    </>}

    {mode==="json"&&<div className="two-col"><section className="panel">
      <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">BILIBILI FAVORITES</p><h2>先从 B 站导出收藏夹 JSON</h2></div><span className="badge">约 5 步</span></div>
      <div className="notice json-import-guide" style={{marginBottom:18}}><ol style={{margin:"0 0 0 20px",padding:0,display:"grid",gap:10}}>
        <li><b>登录 B 站并打开目标收藏夹。</b> 网址中通常带有 <code>fid=...</code> 或 <code>media_id=...</code>。</li>
        <li><b>打开 CookingApp 收藏夹导出脚本。</b> <a href={exporterUrl} target="_blank" rel="noreferrer"><u>打开 export-favorites.js ↗</u></a> 并复制全部代码。</li>
        <li><b>回 B 站收藏夹按 F12 → Console / 控制台。</b> 粘贴脚本并回车。不要把 Cookie、SESSDATA 或密码复制到 CookingApp。</li>
        <li><b>读取完成后点“保存 JSON 文件”。</b> 文件只保存收藏夹和公开视频元数据。</li>
        <li><b>回这里选择 JSON → 预览 → 确认导入。</b> 每条视频只会成为来源待办，不会进入菜谱库；完成手工录入并保存后才产生菜谱。</li>
      </ol></div>
      <h2>1. 选择刚保存的 B 站收藏夹 JSON</h2><div className="dropzone"><div style={{fontSize:44}}>⇩</div><b>选择收藏夹 JSON</b><p className="subtitle">不会上传 Cookie，也不会下载视频文件</p><input type="file" accept="application/json,.json" onChange={event=>pick(event.target.files?.[0])}/></div>
      {prepared&&<><div className="section-head"><h2>2. 导入预览</h2><span className="badge">{prepared.fileName}</span></div><div className="field" style={{marginBottom:16}}><label>本次导入范围</label><select value={scope} onChange={event=>setScope(event.target.value as "ten"|"all")}><option value="ten">先试导入前 10 条（推荐）</option><option value="all">导入全部 {prepared.videos.length} 条</option></select></div><div className="stats import-stats"><div className="stat"><div className="stat-label">本次处理</div><div className="stat-value">{selectedVideos.length}</div></div><div className="stat"><div className="stat-label">预计新增来源</div><div className="stat-value">{selectedVideos.length-duplicates}</div></div><div className="stat"><div className="stat-label">重复来源</div><div className="stat-value">{duplicates}</div></div><div className="stat"><div className="stat-label">无效</div><div className="stat-value">{prepared.skipped.length}</div></div></div><div className="source-preview-list">{selectedVideos.slice(0,12).map(video=><div key={video.bvid}><b>{video.title}</b><span>{video.bvid} · {video.uploader||"UP主未知"}</span></div>)}</div><div className="notice" style={{marginTop:14}}>确认后只写入来源视频库，不会创建空菜谱卡片。</div><button className="btn btn-primary" style={{marginTop:17}} onClick={confirm} disabled={busy}>{busy?"正在写入来源视频库…":`确认导入 ${selectedVideos.length} 条来源`}</button></>}
      {result&&<div className="notice" style={{marginTop:14,background:"var(--leaf-soft)",color:"var(--leaf)"}}><b>{result.mode==="cloud"?"云端来源导入完成":"来源导入完成"}</b><br/>新增来源 {result.added}，重复 {result.duplicates}，失败 {result.failed}，跳过 {result.skipped}。新增来源现在只会出现在待处理列表。</div>}
    </section><aside className="panel"><h2>导入审计记录</h2><p className="subtitle">{isDemo?"当前未登录。":"记录来自 Supabase。"}</p>{importJobs.length?<div className="source-list">{importJobs.slice(0,8).map(job=><div key={job.id} style={{padding:"12px 0",borderBottom:"1px solid var(--line)"}}><b>{job.fileName||"B站收藏夹导入"}</b><small style={{display:"block",marginTop:4}}>{new Date(job.createdAt).toLocaleString("zh-CN")} · 新增来源 {job.added} · 重复 {job.duplicates} · 失败 {job.failed}</small></div>)}</div>:<div className="empty" style={{padding:"28px 0"}}>暂无导入记录。</div>}</aside></div>}

    {mode==="automatic"&&<section className="panel empty"><span>✦</span><h2>一键自动导入放到第三版</h2><p>后续会在统一来源适配器基础上加入字幕/音频转写、OCR、AI 结构化、断点续传和批处理。当前第二版先把可审计的来源待办与人工核验流程稳定下来。</p></section>}
  </div>;
}
