"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCooking } from "@/components/CookingProvider";
import { RecipeCard } from "@/components/RecipeCard";

export default function RecipesPage() {
  const {recipes}=useCooking(); const params=useSearchParams();const [query,setQuery]=useState(()=>params.get("q")||""); const [status,setStatus]=useState(()=>params.get("status")||"all");
  const filtered=useMemo(()=>recipes.filter(recipe=>{
    const text=[recipe.title,recipe.summary,...recipe.tags,...recipe.ingredients.map(i=>i.name)].join(" ").toLowerCase();
    return text.includes(query.toLowerCase()) && (status==="all"||recipe.status===status);
  }),[recipes,query,status]);
  return <div className="page"><header className="page-head"><div><p className="eyebrow">MY RECIPES</p><h1>菜谱库</h1><p className="subtitle">按菜名、食材和状态找到你真正需要的版本。</p></div><Link className="btn btn-primary" href="/recipes/new">＋ 新建菜谱</Link></header>
    <div className="search-panel"><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索菜名、食材或标签…" aria-label="搜索菜谱"/><select className="select" value={status} onChange={e=>setStatus(e.target.value)} aria-label="按状态筛选"><option value="all">全部状态</option><option value="favorite">常做</option><option value="successful">已成功</option><option value="to_try">待尝试</option><option value="inbox">待整理</option><option value="needs_work">需改进</option></select></div>
    <div className="section-head"><h2>{filtered.length} 道菜</h2><span className="subtitle">多标签可组合检索</span></div>
    {filtered.length?<div className="recipe-grid">{filtered.map(r=><RecipeCard key={r.id} recipe={r}/>)}</div>:<div className="panel empty"><span>🥕</span>没有找到匹配菜谱，换一个关键词试试。</div>}
  </div>;
}
