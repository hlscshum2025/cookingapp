"use client";

import { useMemo, useState } from "react";
import { useCooking } from "@/components/CookingProvider";
import { RecipeCard } from "@/components/RecipeCard";
import type { RecipeStatus } from "@/lib/types";

const workflowTags=new Set(["待核验","待整理","待尝试","已成功","需改进","常做","AI建议","AI 建议","未核验","已人工确认","已对照来源"]);
const statusLabels:Record<RecipeStatus,string>={favorite:"常做",successful:"已成功",to_try:"待尝试",inbox:"待整理",needs_work:"需改进"};

type FilterKey="ingredients"|"uploaders"|"tags"|"statuses";
type Filters={ingredients:string[];uploaders:string[];tags:string[];statuses:RecipeStatus[]};
const emptyFilters:Filters={ingredients:[],uploaders:[],tags:[],statuses:[]};

function countValues(values:string[]){const count=new Map<string,number>();values.forEach(value=>{const clean=value.trim();if(clean)count.set(clean,(count.get(clean)||0)+1);});return [...count.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"zh-CN"));}

export default function TagsPage(){
  const {recipes}=useCooking();
  const [query,setQuery]=useState("");
  const [filters,setFilters]=useState<Filters>(emptyFilters);

  const ingredientStats=useMemo(()=>countValues(recipes.flatMap(recipe=>recipe.ingredients.map(item=>item.name))),[recipes]);
  const uploaderStats=useMemo(()=>countValues(recipes.map(recipe=>recipe.source?.uploader||"")),[recipes]);
  const tagStats=useMemo(()=>countValues(recipes.flatMap(recipe=>recipe.tags.filter(tag=>!workflowTags.has(tag.trim())))),[recipes]);
  const statusStats=useMemo(()=>Object.entries(statusLabels).map(([status,label])=>[status,label,recipes.filter(recipe=>recipe.status===status).length] as const).sort((a,b)=>b[2]-a[2]),[recipes]);

  const normalized=query.trim().toLowerCase();
  const visibleIngredients=ingredientStats.filter(([name])=>name.toLowerCase().includes(normalized));
  const visibleUploaders=uploaderStats.filter(([name])=>name.toLowerCase().includes(normalized));
  const visibleTags=tagStats.filter(([name])=>name.toLowerCase().includes(normalized));

  const toggle=(key:FilterKey,value:string)=>setFilters(current=>{
    if(key==="statuses"){
      const status=value as RecipeStatus;const exists=current.statuses.includes(status);
      return {...current,statuses:exists?current.statuses.filter(item=>item!==status):[...current.statuses,status]};
    }
    const list=current[key] as string[];const exists=list.includes(value);
    return {...current,[key]:exists?list.filter(item=>item!==value):[...list,value]};
  });

  const results=useMemo(()=>recipes.filter(recipe=>{
    const ingredientNames=recipe.ingredients.map(item=>item.name.trim());
    const uploader=(recipe.source?.uploader||"").trim();
    const contentTags=recipe.tags.map(tag=>tag.trim());
    const ingredientMatch=!filters.ingredients.length||filters.ingredients.some(item=>ingredientNames.includes(item));
    const uploaderMatch=!filters.uploaders.length||filters.uploaders.includes(uploader);
    const tagMatch=!filters.tags.length||filters.tags.some(tag=>contentTags.includes(tag));
    const statusMatch=!filters.statuses.length||filters.statuses.includes(recipe.status);
    return ingredientMatch&&uploaderMatch&&tagMatch&&statusMatch;
  }),[recipes,filters]);

  const selectedCount=filters.ingredients.length+filters.uploaders.length+filters.tags.length+filters.statuses.length;
  const chip=(active:boolean)=>({cursor:"pointer",border:active?"2px solid currentColor":"1px solid var(--line)",fontWeight:active?800:600} as const);

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">RECIPE DISCOVERY</p><h1>标签总览</h1><p className="subtitle">用食材、UP主、内容标签和状态组合找菜。同一类别内是“任一满足”，不同类别之间是“同时满足”。</p></div><span className="badge">{results.length} / {recipes.length} 道菜</span></header>

    <section className="panel" style={{marginBottom:18}}>
      <div className="section-head"><div><p className="eyebrow">FILTER SEARCH</p><h2>发现与筛选</h2></div>{selectedCount>0&&<button type="button" className="btn btn-secondary" onClick={()=>setFilters(emptyFilters)}>清除全部筛选</button>}</div>
      <input className="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索食材、UP主或内容标签，例如鸡腿、夏叔、下饭……" aria-label="搜索筛选项"/>
      {selectedCount>0&&<div style={{marginTop:14}}><small>当前筛选</small><div className="tag-row" style={{gap:8,marginTop:8}}>
        {filters.ingredients.map(value=><button key={`i-${value}`} className="tag" type="button" onClick={()=>toggle("ingredients",value)}>食材：{value} ×</button>)}
        {filters.uploaders.map(value=><button key={`u-${value}`} className="tag" type="button" onClick={()=>toggle("uploaders",value)}>UP主：{value} ×</button>)}
        {filters.tags.map(value=><button key={`t-${value}`} className="tag" type="button" onClick={()=>toggle("tags",value)}>标签：{value} ×</button>)}
        {filters.statuses.map(value=><button key={`s-${value}`} className="tag" type="button" onClick={()=>toggle("statuses",value)}>状态：{statusLabels[value]} ×</button>)}
      </div></div>}
    </section>

    <section className="panel" style={{marginBottom:18}}>
      <div className="section-head"><div><p className="eyebrow">INGREDIENTS</p><h2>🥩 按食材</h2></div><span className="subtitle">来自菜谱食材字段，自动生成</span></div>
      <div className="tag-row" style={{gap:9}}>{visibleIngredients.map(([name,count])=>{const active=filters.ingredients.includes(name);return <button key={name} type="button" className="tag" style={chip(active)} onClick={()=>toggle("ingredients",name)}>{name} · {count}</button>;})}</div>
      {!visibleIngredients.length&&<p className="subtitle">没有匹配食材。</p>}
    </section>

    <section className="panel" style={{marginBottom:18}}>
      <div className="section-head"><div><p className="eyebrow">CREATORS</p><h2>👨‍🍳 按 UP 主</h2></div><span className="subtitle">来自来源视频作者，不需要手工重复打标签</span></div>
      <div className="tag-row" style={{gap:9}}>{visibleUploaders.map(([name,count])=>{const active=filters.uploaders.includes(name);return <button key={name} type="button" className="tag" style={chip(active)} onClick={()=>toggle("uploaders",name)}>{name} · {count}</button>;})}</div>
      {!visibleUploaders.length&&<p className="subtitle">当前菜谱还没有可用的 UP 主信息。</p>}
    </section>

    <section className="panel" style={{marginBottom:18}}>
      <div className="section-head"><div><p className="eyebrow">CONTENT TAGS</p><h2>🏷 内容标签</h2></div><span className="subtitle">例如下饭、快手、减脂、宴客、夏季</span></div>
      <div className="tag-row" style={{gap:9}}>{visibleTags.map(([name,count])=>{const active=filters.tags.includes(name);return <button key={name} type="button" className="tag" style={chip(active)} onClick={()=>toggle("tags",name)}>{name} · {count}</button>;})}</div>
      {!visibleTags.length&&<p className="subtitle">还没有匹配的内容标签；可在菜谱编辑页添加。</p>}
    </section>

    <section className="panel" style={{marginBottom:22}}>
      <div className="section-head"><div><p className="eyebrow">STATUS</p><h2>⚙ 菜谱状态</h2></div><span className="subtitle">管理状态独立于内容标签</span></div>
      <div className="tag-row" style={{gap:9}}>{statusStats.map(([status,label,count])=>{const value=status as RecipeStatus;const active=filters.statuses.includes(value);return <button key={status} type="button" className="tag" style={chip(active)} onClick={()=>toggle("statuses",status)}>{label} · {count}</button>;})}</div>
    </section>

    <div className="section-head"><div><p className="eyebrow">RESULTS</p><h2>{results.length} 道匹配菜谱</h2></div><span className="subtitle">结果留在当前页，继续加减筛选条件即可</span></div>
    {results.length?<div className="recipe-grid">{results.map(recipe=><RecipeCard key={recipe.id} recipe={recipe}/>)}</div>:<div className="panel empty"><span>🥕</span><h2>没有同时满足这些条件的菜谱</h2><p>移除一个筛选条件，或者换一个同类标签试试。</p></div>}
  </div>;
}
