"use client";

import { useState } from "react";
import { useCooking } from "./CookingProvider";
import { parseSharedRecipeSource, type ImportedSourceDraft } from "@/lib/source-adapters";
import type { SourceExtractionResult } from "@/lib/source-extractor";
import { saveSharedRecipeSource } from "@/lib/source-videos";

export type ImportPlatform="bilibili"|"xiaohongshu"|"xiachufang";

const platformCopy:Record<ImportPlatform,{label:string;eyebrow:string;title:string;description:string;inputLabel:string;placeholder:string;guideTitle:string;steps:string[]}>=
{
  bilibili:{label:"B站",eyebrow:"BILIBILI SINGLE SOURCE",title:"添加单个 B 站视频",description:"粘贴视频链接或分享文本，识别后加入来源待办；视频可以在 CookingApp 中打开并边看边手工整理。",inputLabel:"B站视频链接或分享文本",placeholder:"https://www.bilibili.com/video/BV…",guideTitle:"单个视频怎么导入？",steps:["在 B 站打开视频并复制分享链接。","把链接粘贴到上方输入框，点击“识别来源”。","补充标题或 UP 主后保存到待处理来源。","在下方待处理来源中打开视频，再进入手动录入。"]},
  xiaohongshu:{label:"小红书",eyebrow:"XIAOHONGSHU SOURCE",title:"添加小红书笔记",description:"分享链接用于定位和打开原笔记；正文由你的浏览器通过登录或验证后，用页面提取器生成 CookingApp JSON。",inputLabel:"小红书分享文本或页面提取 JSON",placeholder:"粘贴分享文本，或粘贴网页提取器生成的 CookingApp JSON",guideTitle:"小红书网页提取器怎么用？",steps:["复制下方网页提取脚本。","打开目标笔记并由你完成登录或人机验证。","正文显示后按 F12 → Console，粘贴脚本并回车。","点击页面右上角“复制 CookingApp JSON”。","回到这里粘贴 JSON，识别并保存。"]},
  xiachufang:{label:"下厨房",eyebrow:"XIACHUFANG SOURCE",title:"读取下厨房菜谱",description:"粘贴普通菜谱链接后，CookingApp 会尝试从公开 MIP 页面读取标题、作者、用料和步骤；失败时仍可保存链接手工补充。",inputLabel:"下厨房菜谱链接",placeholder:"https://www.xiachufang.com/recipe/123456/",guideTitle:"自动读取流程",steps:["在下厨房打开公开菜谱并复制网址。","粘贴链接后点击“识别并读取”。","核对自动读取到的标题、用料和步骤。","保存到待处理来源，再进入手动录入完成核验。"]},
};

async function readXiachufang(source:ImportedSourceDraft){
  const response=await fetch("/api/source-extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:source.url,platform:"xiachufang"})});
  const body=await response.json() as SourceExtractionResult&{error?:string};
  if(!response.ok)throw new Error(body.error||"下厨房自动读取失败。");
  const canonical=body.canonicalUrl||source.url;
  const reparsed=canonical!==source.url?parseSharedRecipeSource(`${source.title}\n${canonical}`):source;
  return {
    source:{...source,externalId:reparsed.externalId,url:canonical,title:body.title&&!/待整理来源$/.test(body.title)?body.title:source.title,uploaderName:body.uploaderName||source.uploaderName,description:body.description||source.description,coverUrl:body.coverUrl||source.coverUrl,extractedRecipe:body.extractedRecipe},
    message:body.extractedRecipe?`下厨房正文已读取：${body.extractedRecipe.ingredients.length} 条食材、${body.extractedRecipe.steps.length} 个步骤。进入手动录入会自动预填。`:"已经读取公开页面，但没有识别到完整用料或步骤；可以保存来源后人工补充。",
  };
}

export function UniversalSourceImport({platform}:{platform:ImportPlatform}){
  const {cloudStatus}=useCooking();
  const copy=platformCopy[platform];
  const [input,setInput]=useState("");
  const [draft,setDraft]=useState<ImportedSourceDraft|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [reading,setReading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [copyingExtractor,setCopyingExtractor]=useState(false);

  const copyXhsExtractor=async()=>{
    setCopyingExtractor(true);setError("");
    try{const response=await fetch("/tools/xiaohongshu-page-extractor.js",{cache:"no-store"});if(!response.ok)throw new Error("网页提取脚本读取失败。");await navigator.clipboard.writeText(await response.text());setMessage("脚本已复制。去小红书打开目标笔记并完成人工验证后，在 Console 中运行，再复制 CookingApp JSON。");}
    catch(reason){setError(reason instanceof Error?reason.message:"复制脚本失败，可以改用“打开脚本文本”。");}
    finally{setCopyingExtractor(false);}
  };

  const openXhsPopup=(url:string)=>{const popup=window.open(url,"cookingapp-xiaohongshu","popup=yes,width=560,height=860,resizable=yes,scrollbars=yes");if(!popup)setError("浏览器拦截了小红书弹窗。请允许弹出窗口，或使用“打开原页面”。");};
  const detect=async()=>{
    setError("");setMessage("");
    let initial:ImportedSourceDraft;
    try{initial=parseSharedRecipeSource(input);}catch(reason){setDraft(null);setError(reason instanceof Error?reason.message:"无法识别这个分享内容。");return;}
    if(initial.platform!==platform){setDraft(null);setError(`当前打开的是${copy.label}入口，但这段内容被识别为“${initial.platformLabel}”。请切换到对应平台。`);return;}
    setDraft(initial);
    if(platform==="xiachufang"){
      setReading(true);
      try{const result=await readXiachufang(initial);setDraft(result.source);setMessage(result.message);}catch(reason){setMessage(`链接已识别，但自动读取失败：${reason instanceof Error?reason.message:"未知错误"}。可以先保存来源，再人工补充。`);}finally{setReading(false);}
    }else if(platform==="xiaohongshu"){
      setMessage(initial.browserExtracted?(initial.extractedRecipe?`已读取页面提取 JSON：${initial.extractedRecipe.ingredients.length} 条食材、${initial.extractedRecipe.steps.length} 个步骤。`:"已读取页面提取 JSON，正文会保留供手工整理。"):"分享链接已识别。它可以打开原笔记；如需正文预填，请展开下方提取器指南。");
    }else setMessage("B站视频来源已识别。保存后可在下方打开播放器并边看边录入。");
  };

  const update=<K extends keyof ImportedSourceDraft>(key:K,value:ImportedSourceDraft[K])=>setDraft(current=>current?{...current,[key]:value}:current);
  const save=async()=>{
    if(!draft)return;if(cloudStatus!=="connected"){setError("请先登录 CookingApp，再保存来源待办。");return;}
    setSaving(true);setError("");
    try{await saveSharedRecipeSource(draft);setMessage(`已把“${draft.title}”加入待处理来源。正在刷新列表…`);window.setTimeout(()=>window.location.reload(),500);}catch(reason){setError(reason instanceof Error?reason.message:"保存来源失败。");}finally{setSaving(false);}
  };

  return <section className="platform-single-import">
    <div className="section-head" style={{marginTop:0,alignItems:"flex-start"}}><div><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2><p className="subtitle">{copy.description}</p></div><span className="badge">单条来源</span></div>
    <div className="field"><label>{copy.inputLabel}</label><textarea value={input} onChange={event=>{setInput(event.target.value);setDraft(null);setError("");setMessage("");}} placeholder={copy.placeholder} style={{minHeight:116}}/><small>不要提交 Cookie、密码、SESSDATA 或开发者工具中的请求令牌。</small></div>
    <div className="source-actions compact-actions"><button type="button" className="btn btn-primary" onClick={()=>void detect()} disabled={!input.trim()||reading}>{reading?"正在读取…":platform==="xiachufang"?"识别并读取":"识别来源"}</button>{platform==="xiaohongshu"&&<><button type="button" className="btn btn-secondary" onClick={()=>void copyXhsExtractor()} disabled={copyingExtractor}>{copyingExtractor?"正在复制…":"复制网页提取脚本"}</button><a className="btn btn-secondary" href="/tools/xiaohongshu-page-extractor.js" target="_blank" rel="noreferrer">打开脚本文本 ↗</a></>}</div>
    <details className="import-guide"><summary>{copy.guideTitle}</summary><div className="notice"><ol>{copy.steps.map(step=><li key={step}>{step}</li>)}</ol></div></details>
    {draft&&<div className="notice import-draft-card"><div className="section-head" style={{marginTop:0}}><div><b>识别为：{draft.platformLabel}</b><p className="subtitle" style={{margin:"4px 0 0"}}>保存后进入待处理来源，自动提取内容仍需人工核验。</p></div><span className="badge">{draft.externalId}</span></div><div className="form-grid"><div className="field full"><label>标题</label><input value={draft.title} onChange={event=>update("title",event.target.value)}/></div><div className="field"><label>作者／UP主（可选）</label><input value={draft.uploaderName} onChange={event=>update("uploaderName",event.target.value)} placeholder="没有识别到可以留空"/></div><div className="field full"><label>来源打开方式</label><div className="source-actions compact-actions">{platform==="xiaohongshu"&&<button type="button" className="btn btn-secondary" onClick={()=>openXhsPopup(draft.url)}>小窗口打开网页 ↗</button>}{platform==="xiaohongshu"&&draft.externalId&&<a className="btn btn-secondary" href={`xhsdiscover://item/${encodeURIComponent(draft.externalId)}`}>在小红书 App 打开 ↗</a>}<a className="btn btn-secondary" href={draft.url} target="_blank" rel="noreferrer">打开原页面 ↗</a></div><small>{draft.url}</small></div><div className="field full"><label>读取到的正文／备注</label><textarea value={draft.description} onChange={event=>update("description",event.target.value)} placeholder="没有读取到正文时，可保留分享文字作为参考"/></div></div>{draft.extractedRecipe&&<div className="notice import-structured-ready"><b>结构化内容已就绪</b><br/>食材 {draft.extractedRecipe.ingredients.length} 条 · 步骤 {draft.extractedRecipe.steps.length} 个，保存后会预填手工录入。</div>}<button type="button" className="btn btn-primary import-save" onClick={()=>void save()} disabled={saving||!draft.title.trim()}>{saving?"正在保存…":"保存到待处理来源"}</button></div>}
    {error&&<div className="notice notice-error" role="alert">{error}</div>}
    {message&&<div className="notice notice-success" role="status">{message}</div>}
  </section>;
}
