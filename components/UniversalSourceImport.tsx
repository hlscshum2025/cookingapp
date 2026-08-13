"use client";

import { useState } from "react";
import { useCooking } from "./CookingProvider";
import { parseSharedRecipeSource, type ImportedSourceDraft } from "@/lib/source-adapters";
import { saveSharedRecipeSource } from "@/lib/source-videos";

const platformHints=["下厨房菜谱链接","小红书分享文本／链接","B站单个视频链接","其他菜谱网页链接"];

export function UniversalSourceImport(){
  const {cloudStatus}=useCooking();
  const [input,setInput]=useState("");
  const [draft,setDraft]=useState<ImportedSourceDraft|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);

  const detect=()=>{
    setError("");setMessage("");
    try{setDraft(parseSharedRecipeSource(input));}
    catch(reason){setDraft(null);setError(reason instanceof Error?reason.message:"无法识别这个分享内容。");}
  };

  const update=<K extends keyof ImportedSourceDraft>(key:K,value:ImportedSourceDraft[K])=>{
    setDraft(current=>current?{...current,[key]:value}:current);
  };

  const save=async()=>{
    if(!draft)return;
    if(cloudStatus!=="connected"){setError("请先登录 CookingApp，再保存来源待办。");return;}
    setSaving(true);setError("");setMessage("");
    try{
      await saveSharedRecipeSource(draft);
      setMessage(`已把“${draft.title}”加入待处理来源。正在刷新来源列表…`);
      window.setTimeout(()=>window.location.reload(),500);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"保存来源失败。");
    }finally{setSaving(false);}
  };

  return <section className="panel" style={{marginBottom:18}}>
    <div className="section-head" style={{marginTop:0,alignItems:"flex-start"}}>
      <div><p className="eyebrow">SHARE / URL IMPORT</p><h2>粘贴链接或分享文本</h2><p className="subtitle">适合手机直接从下厨房、小红书或其他菜谱网页“分享 → 复制链接”，不需要 F12。</p></div>
      <span className="badge">单条来源</span>
    </div>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{platformHints.map(item=><span className="tag" key={item}>{item}</span>)}</div>
    <div className="field">
      <label>把平台分享出来的整段文字或网页链接粘贴到这里</label>
      <textarea value={input} onChange={event=>{setInput(event.target.value);setDraft(null);setError("");setMessage("");}} placeholder={"例：\n番茄牛腩｜作者：xxx\nhttps://www.xiachufang.com/recipe/123456/\n\n或者直接粘贴小红书“复制链接”得到的整段分享文本"} style={{minHeight:128}}/>
      <small>第一版不会绕过平台登录、反爬或下载视频；它只识别你主动复制的链接和分享文字，然后存入自己的待处理来源。</small>
    </div>
    <button type="button" className="btn btn-secondary" onClick={detect} disabled={!input.trim()} style={{marginTop:12}}>识别来源</button>

    {draft&&<div className="notice" style={{marginTop:16,background:"var(--leaf-soft)"}}>
      <div className="section-head" style={{marginTop:0}}><div><b>识别为：{draft.platformLabel}</b><p className="subtitle" style={{margin:"4px 0 0"}}>保存后会进入下方“待处理来源”，再走现有手工整理流程。</p></div><span className="badge">{draft.externalId}</span></div>
      <div className="form-grid" style={{marginTop:14}}>
        <div className="field full"><label>标题</label><input value={draft.title} onChange={event=>update("title",event.target.value)}/></div>
        <div className="field"><label>作者／UP主（可选）</label><input value={draft.uploaderName} onChange={event=>update("uploaderName",event.target.value)} placeholder="没有识别到可以留空"/></div>
        <div className="field full"><label>来源链接</label><input value={draft.url} readOnly/></div>
        <div className="field full"><label>分享文本／备注</label><textarea value={draft.description} onChange={event=>update("description",event.target.value)} placeholder="可保留平台分享文字，后续手工录入时参考"/></div>
      </div>
      <button type="button" className="btn btn-primary" onClick={()=>void save()} disabled={saving||!draft.title.trim()} style={{marginTop:14,width:"100%"}}>{saving?"正在保存…":"保存到待处理来源"}</button>
    </div>}

    {error&&<div className="notice" role="alert" style={{marginTop:14,background:"#fbe5de",color:"#923c29"}}>{error}</div>}
    {message&&<div className="notice" role="status" style={{marginTop:14,background:"var(--leaf-soft)",color:"var(--leaf)"}}>{message}</div>}
  </section>;
}
