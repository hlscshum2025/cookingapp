"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCooking } from "@/components/CookingProvider";

const workflowTags=new Set(["待核验","待整理","待尝试","已成功","需改进","常做","AI建议","AI 建议","未核验","已人工确认","已对照来源"]);

export default function TagsPage(){
  const {recipes}=useCooking();
  const [query,setQuery]=useState("");

  const ingredientStats=useMemo(()=>{
    const count=new Map<string,number>();
    recipes.forEach(recipe=>recipe.ingredients.forEach(item=>{
      const name=item.name.trim();
      if(name)count.set(name,(count.get(name)||0)+1);
    }));
    return [...count.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"zh-CN"));
  },[recipes]);

  const contentTags=useMemo(()=>{
    const count=new Map<string,number>();
    recipes.forEach(recipe=>recipe.tags.forEach(tag=>{
      const value=tag.trim();
      if(value&&!workflowTags.has(value))count.set(value,(count.get(value)||0)+1);
    }));
    return [...count.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"zh-CN"));
  },[recipes]);

  const workflowStats=useMemo(()=>{
    const statusLabels:Record<string,string>={favorite:"常做",successful:"已成功",to_try:"待尝试",inbox:"待整理",needs_work:"需改进"};
    const count=new Map<string,number>();
    recipes.forEach(recipe=>{
      const label=statusLabels[recipe.status];
      if(label)count.set(label,(count.get(label)||0)+1);
      recipe.tags.forEach(tag=>{const value=tag.trim();if(workflowTags.has(value))count.set(value,(count.get(value)||0)+1);});
    });
    return [...count.entries()].sort((a,b)=>b[1]-a[1]);
  },[recipes]);

  const normalized=query.trim().toLowerCase();
  const visibleIngredients=ingredientStats.filter(([name])=>name.toLowerCase().includes(normalized));
  const visibleTags=contentTags.filter(([tag])=>tag.toLowerCase().includes(normalized));

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">RECIPE FINDER</p><h1>标签总览</h1><p className="subtitle">像搜索视频一样找菜：优先按食材进入菜谱库，内容标签与审核状态分开显示。</p></div></header>

    <section className="panel" style={{marginBottom:18}}>
      <div className="section-head"><div><p className="eyebrow">INGREDIENT SEARCH</p><h2>按食材找菜</h2></div><span className="badge">{ingredientStats.length} 种食材</span></div>
      <input className="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索鸡腿、土豆、番茄、柠檬……" aria-label="搜索食材或内容标签"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginTop:16}}>
        {visibleIngredients.map(([name,count])=><Link key={name} href={`/recipes?q=${encodeURIComponent(name)}`} className="tag" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",fontSize:14}}><strong>{name}</strong><span>{count}</span></Link>)}
      </div>
      {!visibleIngredients.length&&<div className="empty" style={{padding:"24px 0"}}>没有找到匹配食材。</div>}
    </section>

    <section className="panel" style={{marginBottom:18}}>
      <div className="section-head"><div><p className="eyebrow">CONTENT TAGS</p><h2>其他内容标签</h2></div><span className="subtitle">例如减脂、快手、下饭、无麸质</span></div>
      <div className="tag-row" style={{gap:10}}>{visibleTags.map(([tag,count])=><Link key={tag} href={`/recipes?q=${encodeURIComponent(tag)}`} className="tag" style={{fontSize:13,padding:"9px 12px"}}>{tag} · {count}</Link>)}</div>
      {!visibleTags.length&&<p className="subtitle">当前没有匹配的内容标签。</p>}
    </section>

    <section className="panel">
      <div className="section-head"><div><p className="eyebrow">WORKFLOW</p><h2>整理与审核状态</h2></div><span className="subtitle">只用于管理，不和食材混在一起</span></div>
      <div className="tag-row" style={{gap:10}}>{workflowStats.map(([tag,count])=><span key={tag} className="tag" style={{fontSize:13,padding:"9px 12px",opacity:.78}}>{tag} · {count}</span>)}</div>
      {!workflowStats.length&&<p className="subtitle">目前没有待整理或待审核状态。</p>}
    </section>
  </div>;
}
