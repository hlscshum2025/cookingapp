"use client";

import { useState } from "react";
import { useCooking } from "./CookingProvider";
import { parseSharedRecipeSource, type ImportedSourceDraft } from "@/lib/source-adapters";
import type { SourceExtractionResult } from "@/lib/source-extractor";
import { saveSharedRecipeSource } from "@/lib/source-videos";

const platformHints=["下厨房链接自动读取","小红书网页提取器","B站单个视频链接","其他菜谱网页链接"];

async function readXiachufang(source:ImportedSourceDraft){
  const response=await fetch("/api/source-extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:source.url,platform:"xiachufang"})});
  const body=await response.json() as SourceExtractionResult&{error?:string};
  if(!response.ok)throw new Error(body.error||"下厨房自动读取失败。");
  const canonical=body.canonicalUrl||source.url;
  const reparsed=canonical!==source.url?parseSharedRecipeSource(`${source.title}\n${canonical}`):source;
  return {
    source:{...source,externalId:reparsed.externalId,url:canonical,title:body.title&&!/待整理来源$/.test(body.title)?body.title:source.title,uploaderName:body.uploaderName||source.uploaderName,description:body.description||source.description,coverUrl:body.coverUrl||source.coverUrl,extractedRecipe:body.extractedRecipe},
    message:body.extractedRecipe?`下厨房正文已读取：${body.extractedRecipe.ingredients.length} 条食材、${body.extractedRecipe.steps.length} 个步骤。进入手动录入会自动预填。`:"已经读取下厨房 MIP 页面，但没有识别到完整用料/步骤；仍可保存来源后人工补充。",
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
  const [copyingExtractor,setCopyingExtractor]=useState(false);

  const copyXhsExtractor=async()=>{
    setCopyingExtractor(true);setError("");
    try{
      const response=await fetch("/tools/xiaohongshu-page-extractor.js",{cache:"no-store"});
      if(!response.ok)throw new Error("网页提取脚本读取失败。");
      const script=await response.text();
      await navigator.clipboard.writeText(script);
      setMessage("小红书网页提取脚本已复制。去小红书打开目标笔记并完成人工验证后，F12 → Console 粘贴回车，再点页面右上角“复制 CookingApp JSON”。");
    }catch(reason){setError(reason instanceof Error?reason.message:"复制网页提取脚本失败。可以用旁边的“打开脚本文本”作为备用。 ");}
    finally{setCopyingExtractor(false);}
  };

  const openXhsPopup=(url:string)=>{
    const popup=window.open(url,"cookingapp-xiaohongshu","popup=yes,width=560,height=860,resizable=yes,scrollbars=yes");
    if(!popup)setError("浏览器拦截了小红书弹窗。请允许 CookingApp 弹出窗口，或使用“打开原页面”。");
  };

  const detect=async()=>{
    setError("");setMessage("");
    let initial:ImportedSourceDraft;
    try{initial=parseSharedRecipeSource(input);setDraft(initial);}catch(reason){setDraft(null);setError(reason instanceof Error?reason.message:"无法识别这个分享内容。");return;}
    if(initial.platform==="xiachufang"){
      setReading(true);
      try{const result=await readXiachufang(initial);setDraft(result.source);setMessage(result.message);}catch(reason){setMessage(`下厨房来源已识别，但 MIP 自动读取失败：${reason instanceof Error?reason.message:"未知错误"}。可以先保存来源，之后人工补充。`);}finally{setReading(false);}
      return;
    }
    if(initial.platform==="xiaohongshu"){
      if(initial.browserExtracted){setMessage(initial.extractedRecipe?`已读取小红书浏览器提取 JSON：${initial.extractedRecipe.ingredients.length} 条食材、${initial.extractedRecipe.steps.length} 个步骤。保存后会预填手工录入。`:"已读取小红书浏览器提取 JSON。正文会保存到来源记录；当前没有自动拆出完整食材/步骤，可以进入手工录入继续整理。");}
      else setMessage("小红书分享链接已识别。网页端可能先出现失败、刷新、登录或验证；可以用下方“小窗口打开网页”完成这些操作。CookingApp 不能跨域读取这个窗口，因此正文自动导入仍使用网页提取器。 ");
      return;
    }
    setMessage("来源已识别。B站单视频和普通网页仍进入待处理来源，再人工整理。 ");
  };

  const update=<K extends keyof ImportedSourceDraft>(key:K,value:ImportedSourceDraft[K])=>setDraft(current=>current?{...current,[key]:value}:current);
  const save=async()=>{
    if(!draft)return;
    if(cloudStatus!=="connected"){setError("请先登录 CookingApp，再保存来源待办。");return;}
    setSaving(true);setError("");
    try{await saveSharedRecipeSource(draft);setMessage(`已把“${draft.title}”加入待处理来源。正在刷新来源列表…`);window.setTimeout(()=>window.location.reload(),500);}catch(reason){setError(reason instanceof Error?reason.message:"保存来源失败。");}finally{setSaving(false);}
  };

  return <section className="panel" style={{marginBottom:18}}>
    <div className="section-head" style={{marginTop:0,alignItems:"flex-start"}}><div><p className="eyebrow">SHARE / URL IMPORT</p><h2>链接与网页提取导入</h2><p className="subtitle">下厨房直接读公开 MIP 页面；小红书由你的浏览器先通过登录/验证，再把已经显示出来的正文带回 CookingApp。</p></div><span className="badge">单条来源</span></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>{platformHints.map(item=><span className="tag" key={item}>{item}</span>)}</div>
    <div className="two-col" style={{marginBottom:18}}>
      <div className="notice" style={{background:"#eef7ef"}}><b>下厨房：直接粘贴菜谱链接</b><br/>CookingApp 会识别 recipe ID，并改走下厨房的 MIP 只读页面提取菜名、作者、用料和步骤。你看到的普通网页滑块验证不需要交给程序处理；自动读取失败时仍可保存原链接。</div>
      <div className="notice" style={{background:"#fff4e8"}}><b>小红书：浏览器网页提取器</b><br/>服务器自动抓取容易被小红书拦截，所以改成：你先打开笔记并自己完成登录/验证 → 运行提取脚本 → 复制 CookingApp JSON → 回这里粘贴。小窗口只负责方便查看，不是 B 站那种可控 iframe 播放器；CookingApp 不能跨域读取其中正文。</div>
    </div>
    <div className="field"><label>粘贴下厨房链接、小红书分享文本，或“小红书网页提取 JSON”</label><textarea value={input} onChange={event=>{setInput(event.target.value);setDraft(null);setError("");setMessage("");}} placeholder={"下厨房：\nhttps://www.xiachufang.com/recipe/123456/\n\n小红书：先粘贴分享文本定位来源；需要自动读取正文时，再粘贴网页提取器生成的 JSON。"} style={{minHeight:140}}/><small>不需要单独提供 Cookie、密码、SESSDATA 或开发者工具里的请求令牌。分享链接自己带的查询参数只按原链接保存。</small></div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}><button type="button" className="btn btn-secondary" onClick={()=>void detect()} disabled={!input.trim()||reading}>{reading?"正在读取下厨房 MIP…":"识别来源"}</button><button type="button" className="btn btn-secondary" onClick={()=>void copyXhsExtractor()} disabled={copyingExtractor}>{copyingExtractor?"正在复制…":"复制小红书网页提取脚本"}</button><a className="btn btn-secondary" href="/tools/xiaohongshu-page-extractor.js" target="_blank" rel="noreferrer">打开脚本文本 ↗</a></div>
    <details style={{marginTop:14}}><summary style={{cursor:"pointer",fontWeight:800}}>小红书网页提取器怎么用？</summary><div className="notice" style={{marginTop:10}}><ol style={{margin:"0 0 0 20px",padding:0,display:"grid",gap:8}}><li>点上面的“复制小红书网页提取脚本”。</li><li>打开目标小红书笔记；如果先出现失败、重新加载、登录或人机验证，由你正常完成。</li><li>笔记正文已经能看到后，按 F12 → Console / 控制台，把刚才脚本粘贴进去并回车。</li><li>页面右上角会出现“CookingApp 小红书提取器”，点“复制 CookingApp JSON”。</li><li>回到这个输入框粘贴 JSON → 点“识别来源” → 保存。食材和步骤能识别出来时会直接预填。</li></ol><p className="subtitle" style={{marginBottom:0}}>如果 Chromium 浏览器阻止你第一次向 Console 粘贴，按浏览器自己的提示手动完成“allow pasting/允许粘贴”步骤即可；不要复制 Cookie、密码或 Network 面板里的请求令牌。</p></div></details>
    {draft&&<div className="notice" style={{marginTop:16,background:"var(--leaf-soft)"}}><div className="section-head" style={{marginTop:0}}><div><b>识别为：{draft.platformLabel}</b><p className="subtitle" style={{margin:"4px 0 0"}}>{draft.platform==="xiachufang"?"下厨房会优先使用 MIP 自动读取。":draft.platform==="xiaohongshu"?(draft.browserExtracted?"这是浏览器网页提取结果。":"当前只是分享链接；如需正文自动预填，请使用网页提取器。 "):"保存后进入待处理来源。"}</p></div><span className="badge">{draft.externalId}</span></div><div className="form-grid" style={{marginTop:14}}><div className="field full"><label>标题</label><input value={draft.title} onChange={event=>update("title",event.target.value)}/></div><div className="field"><label>作者／UP主（可选）</label><input value={draft.uploaderName} onChange={event=>update("uploaderName",event.target.value)} placeholder="没有识别到可以留空"/></div><div className="field full"><label>来源打开方式</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{draft.platform==="xiaohongshu"&&<button type="button" className="btn btn-secondary" onClick={()=>openXhsPopup(draft.url)}>小窗口打开网页 ↗</button>}{draft.platform==="xiaohongshu"&&draft.externalId&&<a className="btn btn-secondary" href={`xhsdiscover://item/${encodeURIComponent(draft.externalId)}`}>在小红书 App 打开 ↗</a>}<a className="btn btn-secondary" href={draft.url} target="_blank" rel="noreferrer">打开原页面 ↗</a></div><small style={{overflowWrap:"anywhere"}}>{draft.url}</small></div><div className="field full"><label>读取到的正文／备注</label><textarea value={draft.description} onChange={event=>update("description",event.target.value)} placeholder="没有读取到正文时，可保留分享文字作为参考"/></div></div>{draft.platform==="xiaohongshu"&&!draft.browserExtracted&&<div className="notice" style={{marginTop:12,background:"rgba(255,255,255,.55)"}}><b>关于小红书视频/图文：</b>“在小红书 App 打开”会用笔记 ID 交给小红书客户端处理；桌面“小窗口打开网页”会复用浏览器登录状态。两种方式都只负责查看，CookingApp 无法像 B 站播放器那样控制播放或直接读取跨域页面。</div>}{draft.extractedRecipe&&<div className="notice" style={{marginTop:12,background:"rgba(255,255,255,.55)"}}><b>结构化内容已就绪</b><br/>食材 {draft.extractedRecipe.ingredients.length} 条 · 步骤 {draft.extractedRecipe.steps.length} 个。保存来源后进入手动录入会自动填入，但仍保持“未核验”。</div>}<button type="button" className="btn btn-primary" onClick={()=>void save()} disabled={saving||!draft.title.trim()} style={{marginTop:14,width:"100%"}}>{saving?"正在保存…":"保存到待处理来源"}</button></div>}
    {error&&<div className="notice" role="alert" style={{marginTop:14,background:"#fbe5de",color:"#923c29"}}>{error}</div>}
    {message&&<div className="notice" role="status" style={{marginTop:14,background:"var(--leaf-soft)",color:"var(--leaf)"}}>{message}</div>}
  </section>;
}
