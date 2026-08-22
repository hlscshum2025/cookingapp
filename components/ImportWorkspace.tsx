"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { prepareBilibiliImport, type PreparedBilibiliImport } from "@/lib/bilibili";
import { useCooking } from "@/components/CookingProvider";
import { ManualRecipeEntry } from "@/components/ManualRecipeEntry";
import { PlatformFeedbackForm } from "@/components/PlatformFeedbackForm";
import { UniversalSourceImport, type ImportPlatform } from "@/components/UniversalSourceImport";
import { discardPendingSourceVideo, loadPendingSourceVideos } from "@/lib/source-videos";
import type { ImportResult, SourceVideo } from "@/lib/types";
import { useLocale } from "@/lib/i18n";

type PlatformChoice=ImportPlatform|"more";
const exporterUrl="https://github.com/hlscshum2025/cookingapp/blob/main/tools/bilibili-favorites-exporter/export-favorites.js";
const platformLabel=(platform:string)=>({bilibili:"Bilibili",xiachufang:"下厨房",xiaohongshu:"小红书",generic_web:"网页"}[platform]||platform||"来源");
const platforms:{id:PlatformChoice;labelKey:"imports.bilibili"|"imports.xiaohongshu"|"imports.xiachufang"|"imports.more";icon:string;badges:string[]}[]=[
  {id:"bilibili",labelKey:"imports.bilibili",icon:"/platforms/bilibili.ico",badges:["▶ 内嵌视频","⇩ JSON 批量","✎ 人工核验"]},
  {id:"xiaohongshu",labelKey:"imports.xiaohongshu",icon:"/platforms/xiaohongshu.ico",badges:["↗ 原站查看","⌨ 页面提取","◫ OCR 开发中"]},
  {id:"xiachufang",labelKey:"imports.xiachufang",icon:"/platforms/xiachufang.ico",badges:["⚡ 自动读取","✎ 人工补充","◫ OCR 后续"]},
  {id:"more",labelKey:"imports.more",icon:"",badges:["＋ 提交建议"]},
];

function durationLabel(seconds?:number){
  if(!seconds)return "时长未知";
  const minutes=Math.floor(seconds/60);
  return `${minutes}:${String(seconds%60).padStart(2,"0")}`;
}

export function ImportWorkspace(){
  const {sourceVideos,importJobs,isDemo,cloudStatus,importVideos}=useCooking();
  const {t}=useLocale();
  const [platform,setPlatform]=useState<PlatformChoice>("bilibili");
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
    }catch(reason){setError(reason instanceof Error?reason.message:"来源读取失败。");}
  },[cloudStatus]);

  useEffect(()=>{void refreshPending();},[refreshPending]);
  const existing=useMemo(()=>new Set(sourceVideos.filter(video=>video.platform==="bilibili").map(video=>video.externalId)),[sourceVideos]);
  const filteredVideos=useMemo(()=>{
    const query=search.trim().toLowerCase();
    if(!query)return pendingVideos;
    return pendingVideos.filter(video=>[video.title,video.externalId,video.uploaderName,platformLabel(video.platform)].some(value=>value.toLowerCase().includes(query)));
  },[search,pendingVideos]);
  const selected=pendingVideos.find(video=>video.id===selectedId)??pendingVideos[0];
  const selectedVideos=prepared?.videos.slice(0,scope==="ten"?10:undefined)||[];
  const duplicates=selectedVideos.filter(video=>existing.has(video.bvid)).length;
  const selectedIsBilibili=selected?.platform==="bilibili";

  const chooseVideo=(id:string)=>{setSelectedId(id);setManualOpen(false);setVideoCollapsed(false);};
  const startManual=()=>{if(selected){setManualOpen(true);setVideoCollapsed(false);window.setTimeout(()=>document.getElementById("manual-workspace")?.scrollIntoView({behavior:"smooth"}),0);}};
  const pick=async(file?:File)=>{if(!file)return;setError("");setResult(null);try{setPrepared(prepareBilibiliImport(JSON.parse(await file.text()),file.name));}catch(reason){setPrepared(null);setError(reason instanceof Error?reason.message:"JSON 读取失败");}};
  const confirm=async()=>{
    if(!prepared)return;setBusy(true);setError("");
    try{const next=await importVideos(selectedVideos,{collectionId:prepared.collectionId,fileName:prepared.fileName,skipped:scope==="all"?prepared.skipped.length:0});setResult(next);await refreshPending();}
    catch(reason){setError(reason instanceof Error?reason.message:"导入失败");}
    finally{setBusy(false);}
  };
  const deleteSelected=async()=>{
    if(!selected)return;
    if(!window.confirm(`确认从 CookingApp 来源待办中删除“${selected.title}”吗？\n\n这只删除 CookingApp 保存的来源元数据，不会影响原平台内容。`))return;
    setDeleting(true);setError("");
    try{await discardPendingSourceVideo(selected.id);setManualOpen(false);await refreshPending();}catch(reason){setError(reason instanceof Error?reason.message:"来源删除失败。");}finally{setDeleting(false);}
  };

  const connectionNotice=cloudStatus==="unconfigured"?<><b>Supabase 尚未配置：不会收到任何数据。</b></>:cloudStatus==="signed_out"?<><b>CookingApp 尚未登录。</b> 请先 <Link href="/login"><u>完成邮箱登录</u></Link>。</>:cloudStatus==="error"?<><b>Supabase 连接异常。</b> 请到“设置”查看详情。</>:null;

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">{t("imports.eyebrow")}</p><h1>{t("imports.title")}</h1><p className="subtitle">{t("imports.subtitle")}</p></div><span className="badge">{pendingVideos.length} {t("imports.pending")}</span></header>
    {connectionNotice&&<div className="notice connection-notice">{connectionNotice}</div>}
    {error&&<div className="notice notice-error" role="alert">{error}</div>}

    <nav className="import-platform-nav" aria-label="来源平台">
      {platforms.map(item=><button type="button" key={item.id} className={platform===item.id?"active":"inactive"} aria-pressed={platform===item.id} onClick={()=>setPlatform(item.id)}>
        <span className="platform-logo">{item.icon?<img src={item.icon} alt="" aria-hidden="true"/>:<b>＋</b>}</span>
        <strong>{t(item.labelKey)}</strong>
        <span className="platform-capabilities">{item.badges.map(badge=><small key={badge}>{badge}</small>)}</span>
      </button>)}
    </nav>

    <section className={`platform-import-panel platform-${platform}`}>
      {platform==="bilibili"&&<>
        <UniversalSourceImport platform="bilibili"/>
        <div className="divider"/>
        <div className="two-col bilibili-batch-import"><section>
          <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">BILIBILI FAVORITES</p><h2>批量导入收藏夹 JSON</h2><p className="subtitle">批量导入只建立来源待办，不会生成空菜谱。</p></div><span className="badge">收藏夹</span></div>
          <details className="import-guide"><summary>展开五步导出与导入指南</summary><div className="notice"><ol><li>登录 B 站并打开目标收藏夹。</li><li><a href={exporterUrl} target="_blank" rel="noreferrer"><u>打开导出脚本并复制全部代码 ↗</u></a></li><li>回到收藏夹，按 F12 → Console，粘贴脚本并回车。</li><li>读取完成后点“保存 JSON 文件”。</li><li>回这里选择 JSON，预览并确认导入。</li></ol><p>不要提交 Cookie、SESSDATA 或密码。</p></div></details>
          <div className="dropzone"><div className="dropzone-icon">⇩</div><b>选择收藏夹 JSON</b><p className="subtitle">不会上传 Cookie，也不会下载视频文件</p><input type="file" accept="application/json,.json" onChange={event=>pick(event.target.files?.[0])}/></div>
          {prepared&&<><div className="section-head"><h2>导入预览</h2><span className="badge">{prepared.fileName}</span></div><div className="field"><label>本次导入范围</label><select value={scope} onChange={event=>setScope(event.target.value as "ten"|"all")}><option value="ten">先试导入前 10 条（推荐）</option><option value="all">导入全部 {prepared.videos.length} 条</option></select></div><div className="stats import-stats"><div className="stat"><div className="stat-label">本次处理</div><div className="stat-value">{selectedVideos.length}</div></div><div className="stat"><div className="stat-label">预计新增</div><div className="stat-value">{selectedVideos.length-duplicates}</div></div><div className="stat"><div className="stat-label">重复</div><div className="stat-value">{duplicates}</div></div><div className="stat"><div className="stat-label">无效</div><div className="stat-value">{prepared.skipped.length}</div></div></div><div className="source-preview-list">{selectedVideos.slice(0,12).map(video=><div key={video.bvid}><b>{video.title}</b><span>{video.bvid} · {video.uploader||"UP主未知"}</span></div>)}</div><button className="btn btn-primary import-save" onClick={confirm} disabled={busy}>{busy?"正在写入来源视频库…":`确认导入 ${selectedVideos.length} 条来源`}</button></>}
          {result&&<div className="notice notice-success"><b>{result.mode==="cloud"?"云端来源导入完成":"来源导入完成"}</b><br/>新增 {result.added}，重复 {result.duplicates}，失败 {result.failed}，跳过 {result.skipped}。</div>}
        </section><aside className="import-audit"><h2>导入审计记录</h2><p className="subtitle">{isDemo?"当前未登录。":"记录来自 Supabase。"}</p>{importJobs.length?<div className="source-list">{importJobs.slice(0,8).map(job=><div key={job.id}><b>{job.fileName||"B站收藏夹导入"}</b><small>{new Date(job.createdAt).toLocaleString("zh-CN")} · 新增 {job.added} · 重复 {job.duplicates} · 失败 {job.failed}</small></div>)}</div>:<div className="empty" style={{padding:"28px 0"}}>暂无导入记录。</div>}</aside></div>
      </>}
      {platform==="xiaohongshu"&&<UniversalSourceImport platform="xiaohongshu"/>}
      {platform==="xiachufang"&&<UniversalSourceImport platform="xiachufang"/>}
      {platform==="more"&&<PlatformFeedbackForm/>}
    </section>

    <div className="section-head pending-source-head"><div><p className="eyebrow">REVIEW QUEUE</p><h2>待处理来源与手工录入</h2><p className="subtitle">不论从哪个平台导入，都会先进入这里核验；保存正式菜谱后自动移出。</p></div><span className="badge">{filteredVideos.length}</span></div>
    {pendingVideos.length?<div className="source-workspace">
      <aside className="panel source-browser"><input className="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索标题、平台、作者或来源ID" aria-label="搜索待处理来源"/><div className="source-video-list">{filteredVideos.map(video=><button key={video.id} className={selected?.id===video.id?"active":""} onClick={()=>chooseVideo(video.id)}><span className="source-thumb">{video.coverUrl?<span className="source-thumb-image" style={{backgroundImage:`url(${JSON.stringify(video.coverUrl)})`}}/>:<span>{platformLabel(video.platform)}</span>}</span><span><strong>{video.title}</strong><small>{platformLabel(video.platform)} · {video.uploaderName||video.externalId}</small></span></button>)}</div></aside>
      {selected&&<section className={`source-review ${manualOpen?"floating-active":""}`}><div className={`panel source-review-card ${manualOpen&&selectedIsBilibili?"is-floating":""} ${videoCollapsed?"is-collapsed":""}`}>
        <div className="source-actions compact-actions"><a className="btn btn-secondary" href={selected.url} target="_blank" rel="noreferrer">打开{platformLabel(selected.platform)}原页面 ↗</a>{manualOpen&&selectedIsBilibili&&<button type="button" className="btn btn-secondary" onClick={()=>setVideoCollapsed(value=>!value)}>{videoCollapsed?"显示视频":"收起视频"}</button>}</div>
        {manualOpen&&selectedIsBilibili&&<div className="floating-video-head"><b>边看边录：{selected.title}</b></div>}
        {selectedIsBilibili?<div className="video-frame"><iframe key={selected.externalId} title={`B站视频：${selected.title}`} src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(selected.externalId)}&high_quality=1&autoplay=0&danmaku=0`} allow="fullscreen; picture-in-picture" allowFullScreen/></div>:<div className="notice source-external-notice"><b>{platformLabel(selected.platform)}来源</b><br/>该平台不在 CookingApp 内嵌，以免受到登录、跳转和跨域限制。请打开原页面查看，CookingApp 保留来源文本供你对照录入。</div>}
        <div className="source-detail-head"><div><p className="eyebrow">{platformLabel(selected.platform)} · {selected.externalId}</p><h2>{selected.title}</h2><p className="subtitle">{selected.uploaderName||"作者未知"}{selectedIsBilibili?` · ${durationLabel(selected.durationSeconds)}`:""}</p></div><span className={`badge ${selected.availability==="available"?"":"warn"}`}>{selected.availability==="available"?"可访问":"需核验"}</span></div>
        {selected.description&&<p className="source-description">{selected.description}</p>}
        <div className="source-actions"><button className="btn btn-primary" onClick={startManual}>进入手动录入 →</button><button className="btn btn-danger" onClick={deleteSelected} disabled={deleting}>{deleting?"正在删除…":"删除这个来源"}</button></div>
        <div className="notice source-save-note">保存手工菜谱后，对应来源会自动标记完成并从这里移出；菜谱仍保留原平台链接和作者信息。</div>
      </div></section>}
    </div>:<div className="panel empty"><span>✓</span><h2>待处理来源已经清空</h2><p>从上方选择平台，添加单个来源或批量导入 B站收藏夹。</p></div>}
    {manualOpen&&selected&&<section id="manual-workspace" className="manual-workspace-section"><div className="section-head"><div><p className="eyebrow">MANUAL ENTRY</p><h2>手动录入：{selected.title}</h2><p className="subtitle">正式保存菜谱后，这条来源会自动标记完成。</p></div><button className="btn btn-secondary" onClick={()=>setManualOpen(false)}>收起录入区</button></div><ManualRecipeEntry key={selected.id} initialSource={selected}/></section>}
  </div>;
}
