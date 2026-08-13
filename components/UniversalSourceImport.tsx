"use client";

import { useState } from "react";
import { useCooking } from "./CookingProvider";
import { parseSharedRecipeSource, type ImportedSourceDraft } from "@/lib/source-adapters";
import type { SourceExtractionResult } from "@/lib/source-extractor";
import { saveSharedRecipeSource } from "@/lib/source-videos";

const platformHints=["下厨房菜谱链接","小红书分享文本／链接","B站单个视频链接","其他菜谱网页链接"];

async function autoRead(source:ImportedSourceDraft){
  if(source.platform!=="xiachufang"&&source.platform!=="xiaohongshu")return {source,message:""};
  const response=await fetch("/api/source-extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:source.url,platform:source.platform})});
  const body=await response.json() as SourceExtractionResult&{error?:string};
  if(!response.ok)throw new Error(body.error||"原页面自动读取失败。");
  const canonical=body.canonicalUrl||source.url;
  const reparsed=canonical!==source.url?parseSharedRecipeSource(`${source.title}\n${canonical}`):source;
  const extracted=body.extractedRecipe;
  return {
    source:{...source,externalId:reparsed.externalId,url:canonical,title:body.title&&!/待整理来源$/.test(body.title)?body.title:source.title,uploaderName:body.uploaderName||source.uploaderName,description:body.description||source.description,coverUrl:body.coverUrl||source.coverUrl,extractedRecipe:extracted},
    message:extracted?`已自动读取：${extracted.ingredients.length} 条食材、${extracted.steps.length} 个步骤。进入手动录入时会直接预填。`:"已读取原页面的标题、正文摘要和封面；这个页面暂时没有识别到结构化食材/步骤。",
  };
}

export function UniversalSourceImport(){
  const {cloudStatus}=useCooking();
  const [input,setInput]=useState("");
  const [draft,setDraft]=useState<ImportedSourceDraft|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [reading,setReading]=useState(false);
  const [saving,setSaving]=useState(false);

  const detect=async()=>{
    setError("");setMessage("");
    let initial:ImportedSourceDraft;
    try{initial=parseSharedRecipeSource(input);setDraft(initial);}catch(reason){setDraft(null);setError(reason instanceof Error?reason.message:"无法识别这个分享内容。");return;}
    if(initial.platform!=="xiachufang"&&initial.platform!=="xiaohongshu"){setMessage("来源已识别。B站单视频和普通网页仍走现有待处理流程。");return;}
    setReading(true);
    try{const result=await autoRead(initial);setDraft(result.source);setMessage(result.message);}catch(reason){setMessage(`已识别为${initial.platformLabel}，但自动读取原页面失败：${reason instanceof Error?reason.message:"未知错误"} 你仍然可以保存这条来源，之后再人工对照。`);}finally{setReading(false);}
  };

  const update=<K extends keyof ImportedSourceDraft>(key:K,value:ImportedSourceDraft[K])=>setDraft(current=>current?{...current,[key]:value}:current);
  const save=async()=>{
    if(!draft)return;
    if(cloudStatus!=="connected"){setError("请先登录 CookingApp，再保存来源待办。");return;}
    setSaving(true);setError("");
    try{await saveSharedRecipeSource(draft);setMessage(`已把“${draft.title}”加入待处理来源。正在刷新来源列表…`);window.setTimeout(()=>window.location.reload(),500);}catch(reason){setError(reason instanceof Error?reason.message:"保存来源失败。");}finally{setSaving(false);}
  };

  return <section className="panel" style={{marginBottom:18}}>
    <div className="section-head" style={{marginTop:0,alignItems:"flex-start"}}><div><p className="eyebrow">SHARE / URL IMPORT</p><h2>粘贴链接或分享文本</h2><p className="subtitle">下厨房和小红书会尝试直接读取公开页面文本；读取成功后，食材和步骤会预填到手工录入。</p></div><span className="badge">单条来源</span></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{platformHints.map(item=><span className="tag" key={item}>{item}</span>)}</div>
    <div className="field"><label>把平台分享出来的整段文字或网页链接粘贴到这里</label><textarea value={input} onChange={event=>{setInput(event.target.value);setDraft(null);setError("");setMessage("");}} placeholder={"例：\n红烧牛肉\nhttps://www.xiachufang.com/recipe/123456/\n\n小红书可以直接粘贴“复制链接”得到的整段分享文字"} style={{minHeight:128}}/><small>自动读取只请求你粘贴的下厨房/小红书公开 HTTPS 页面，不会使用 Cookie、账号令牌，也不会尝试绕过登录或反爬。</small></div>
    <button type="button" className="btn btn-secondary" onClick={()=>void detect()} disabled={!input.trim()||reading} style={{marginTop:12}}>{reading?"正在读取原页面…":"识别并自动读取"}</button>

    {draft&&<div className="notice" style={{marginTop:16,background:"var(--leaf-soft)"}}>
      <div className="section-head" style={{marginTop:0}}><div><b>识别为：{draft.platformLabel}</b><p className="subtitle" style={{margin:"4px 0 0"}}>保存后进入下方“待处理来源”；如果读到了食材/步骤，进入手动录入会直接预填。</p></div><span className="badge">{draft.externalId}</span></div>
      <div className="form-grid" style={{marginTop:14}}><div className="field full"><label>标题</label><input value={draft.title} onChange={event=>update("title",event.target.value)}/></div><div className="field"><label>作者／UP主（可选）</label><input value={draft.uploaderName} onChange={event=>update("uploaderName",event.target.value)} placeholder="没有识别到可以留空"/></div><div className="field full"><label>来源链接</label><a className="btn btn-secondary" href={draft.url} target="_blank" rel="noreferrer" style={{justifyContent:"flex-start",overflowWrap:"anywhere",height:"auto",minHeight:42}}>打开识别出的原页面 ↗</a><small style={{overflowWrap:"anywhere"}}>{draft.url}</small></div><div className="field full"><label>读取到的正文／备注</label><textarea value={draft.description} onChange={event=>update("description",event.target.value)} placeholder="没有读取到正文时，可保留你复制的分享文字作为参考"/></div></div>
      {draft.extractedRecipe&&<div className="notice" style={{marginTop:12,background:"rgba(255,255,255,.55)"}}><b>结构化内容已读取</b><br/>食材 {draft.extractedRecipe.ingredients.length} 条 · 步骤 {draft.extractedRecipe.steps.length} 个。保存来源后打开“进入手动录入”，这些内容会自动填进去，但仍保持“未核验”。</div>}
      <button type="button" className="btn btn-primary" onClick={()=>void save()} disabled={saving||!draft.title.trim()} style={{marginTop:14,width:"100%"}}>{saving?"正在保存…":"保存到待处理来源"}</button>
    </div>}
    {error&&<div className="notice" role="alert" style={{marginTop:14,background:"#fbe5de",color:"#923c29"}}>{error}</div>}
    {message&&<div className="notice" role="status" style={{marginTop:14,background:"var(--leaf-soft)",color:"var(--leaf)"}}>{message}</div>}
  </section>;
}
