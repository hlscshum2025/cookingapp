"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCooking } from "@/components/CookingProvider";
import { RecipeCard } from "@/components/RecipeCard";

export default function RecipesPage() {
  const {recipes}=useCooking(); const params=useSearchParams();const [query,setQuery]=useState(()=>params.get("q")||""); const [status,setStatus]=useState(()=>params.get("status")||"all");
  const filtered=useMemo(()=>recipes.filter(recipe=>{
    const text=[recipe.title,recipe.summary,...recipe.tags,...recipe.ingredients.map(i=>i.name),recipe.source?.uploader||""].join(" ").toLowerCase();
    return text.includes(query.toLowerCase()) && (status==="all"||recipe.status===status);
  }),[recipes,query,status]);
  return <div className="page"><header className="page-head"><div><p className="eyebrow">MY RECIPES</p><h1>菜谱库</h1><p className="subtitle">适合“已经知道想找什么”时快速搜索；如果想按食材、UP主和多个标签组合浏览，请使用标签总览。</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link className="btn btn-secondary" href="/tags">打开标签筛选</Link><Link className="btn btn-primary" href="/recipes/new">＋ 新建菜谱</Link></div></header>
    <div className="search-panel"><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索菜名、食材、标签或 UP主…" aria-label="搜索菜谱"/><select className="select" value={status} onChange={e=>setStatus(e.target.value)} aria-label="按状态筛选"><option value="all">全部状态</option><option value="favorite">常做</option><option value="successful">已成功</option><option value="to_try">待尝试</option><option value="inbox">待整理</option><option value="needs_work">需改进</option></select></div>
    <div className="section-head"><h2>{filtered.length} 道菜</h2><span className="subtitle">这里是全文搜索；组合标签筛选在“标签总览”</span></div>
    {filtered.length?<div className="recipe-grid">{filtered.map(r=><RecipeCard key={r.id} recipe={r}/>)}</div>:<div className="panel empty"><span>🥕</span>没有找到匹配菜谱，换一个关键词试试。</div>}
  </div>;
}
