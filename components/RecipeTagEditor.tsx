"use client";

import { useMemo, useState } from "react";

const workflowTags=new Set(["待核验","待整理","待尝试","已成功","需改进","常做","AI建议","AI 建议","未核验","已人工确认","已对照来源"]);

export function RecipeTagEditor({value,onChange,suggestions=[]}:{value:string[];onChange:(tags:string[])=>void;suggestions?:string[]}){
  const [input,setInput]=useState("");
  const clean=value.map(tag=>tag.trim()).filter(Boolean);
  const selected=new Set(clean);
  const available=useMemo(()=>[...new Set(suggestions.map(tag=>tag.trim()).filter(tag=>tag&&!workflowTags.has(tag)))].filter(tag=>!selected.has(tag)).slice(0,18),[suggestions,clean.join("|")]);
  const add=(raw:string)=>{
    const next=raw.trim().replace(/^[#＃]/,"");
    if(!next||workflowTags.has(next)||selected.has(next)){setInput("");return;}
    onChange([...clean,next]);setInput("");
  };
  const remove=(tag:string)=>onChange(clean.filter(item=>item!==tag));
  return <div>
    <div className="tag-row" style={{gap:8,minHeight:34}}>
      {clean.map(tag=><button key={tag} type="button" className="tag" onClick={()=>remove(tag)} title="点击移除" style={{cursor:"pointer",border:0}}>#{tag} ×</button>)}
      {!clean.length&&<span className="subtitle">还没有内容标签。</span>}
    </div>
    <div style={{display:"flex",gap:8,marginTop:10}}>
      <input value={input} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"||event.key===","||event.key==="，"){event.preventDefault();add(input);}}} placeholder="输入下饭、快手、减脂、宴客…" aria-label="添加菜谱标签"/>
      <button type="button" className="btn btn-secondary" onClick={()=>add(input)}>＋ 添加</button>
    </div>
    {available.length>0&&<div style={{marginTop:12}}><small>常用标签（点击添加）</small><div className="tag-row" style={{gap:8,marginTop:7}}>{available.map(tag=><button key={tag} type="button" className="tag" onClick={()=>add(tag)} style={{cursor:"pointer"}}>＋ {tag}</button>)}</div></div>}
    <small style={{display:"block",marginTop:10}}>只添加描述菜谱风格、场景或目标的标签。食材和 UP 主会由系统自动用于筛选，不需要重复填写。</small>
  </div>;
}
