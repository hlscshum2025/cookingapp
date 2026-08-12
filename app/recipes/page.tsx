"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCooking } from "@/components/CookingProvider";
import { RecipeCard } from "@/components/RecipeCard";
import { loadPublicRecipes } from "@/lib/public-recipes";
import { getCurrentAppRole } from "@/lib/roles";
import type { AppRole } from "@/lib/permissions";
import type { PublicRecipe } from "@/lib/types";

type LibraryScope="mine"|"public";

export default function RecipesPage() {
  const {recipes,cloudStatus}=useCooking();
  const params=useSearchParams();
  const [scope,setScope]=useState<LibraryScope>(()=>params.get("scope")==="public"?"public":"mine");
  const [query,setQuery]=useState(()=>params.get("q")||"");
  const [status,setStatus]=useState(()=>params.get("status")||"all");
  const [publicRecipes,setPublicRecipes]=useState<PublicRecipe[]>([]);
  const [publicLoading,setPublicLoading]=useState(false);
  const [publicError,setPublicError]=useState("");
  const [role,setRole]=useState<AppRole>("user");

  useEffect(()=>{
    if(cloudStatus!=="connected")return;
    void getCurrentAppRole().then(setRole);
  },[cloudStatus]);

  useEffect(()=>{
    if(scope!=="public"||cloudStatus!=="connected")return;
    setPublicLoading(true);setPublicError("");
    void loadPublicRecipes()
      .then(setPublicRecipes)
      .catch(reason=>setPublicError(reason instanceof Error?reason.message:"公开菜谱读取失败。"))
      .finally(()=>setPublicLoading(false));
  },[scope,cloudStatus]);

  const myFiltered=useMemo(()=>recipes.filter(recipe=>{
    const text=[recipe.title,recipe.summary,...recipe.tags,...recipe.ingredients.map(i=>i.name),recipe.source?.uploader||""].join(" ").toLowerCase();
    return text.includes(query.toLowerCase()) && (status==="all"||recipe.status===status);
  }),[recipes,query,status]);

  const publicFiltered=useMemo(()=>publicRecipes.filter(item=>{
    const recipe=item.recipe;
    const text=[recipe.title,recipe.summary,...recipe.tags,...recipe.ingredients.map(i=>i.name),recipe.source?.uploader||""].join(" ").toLowerCase();
    return text.includes(query.toLowerCase());
  }),[publicRecipes,query]);

  const switchScope=(next:LibraryScope)=>{setScope(next);setQuery("");setStatus("all");};

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">RECIPE LIBRARY</p><h1>菜谱库</h1><p className="subtitle">“我的菜谱”只属于当前账号；“公开菜谱”只显示经过管理员审核通过的只读快照。</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{role==="admin"&&<Link className="btn btn-secondary" href="/recipes/review">审核公开申请</Link>}<Link className="btn btn-secondary" href="/tags">打开标签筛选</Link><Link className="btn btn-primary" href="/recipes/new">＋ 新建菜谱</Link></div></header>

    <div className="search-panel" style={{alignItems:"center"}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}} role="tablist" aria-label="菜谱库范围">
        <button type="button" className={`btn ${scope==="mine"?"btn-primary":"btn-secondary"}`} onClick={()=>switchScope("mine")} role="tab" aria-selected={scope==="mine"}>我的菜谱 · {recipes.length}</button>
        <button type="button" className={`btn ${scope==="public"?"btn-primary":"btn-secondary"}`} onClick={()=>switchScope("public")} role="tab" aria-selected={scope==="public"}>公开菜谱{publicRecipes.length?` · ${publicRecipes.length}`:""}</button>
      </div>
      <input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={scope==="mine"?"搜索我的菜名、食材、标签或 UP主…":"搜索公开菜谱、食材、标签或 UP主…"} aria-label="搜索菜谱"/>
      {scope==="mine"&&<select className="select" value={status} onChange={e=>setStatus(e.target.value)} aria-label="按状态筛选"><option value="all">全部状态</option><option value="favorite">常做</option><option value="successful">已成功</option><option value="to_try">待尝试</option><option value="inbox">待整理</option><option value="needs_work">需改进</option></select>}
    </div>

    {scope==="mine"?<>
      <div className="section-head"><h2>{myFiltered.length} 道我的菜</h2><span className="subtitle">全文搜索；组合标签筛选在“标签总览”</span></div>
      {myFiltered.length?<div className="recipe-grid">{myFiltered.map(r=><RecipeCard key={r.id} recipe={r}/>)}</div>:recipes.length?<div className="panel empty"><span>🥕</span>没有找到匹配菜谱，换一个关键词试试。</div>:<div className="panel empty"><span>🍳</span><h2>你的个人菜谱库还是空的</h2><p>可以自己新建，也可以先看看管理员审核过的公开菜谱。</p><div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:16}}><button className="btn btn-primary" onClick={()=>switchScope("public")}>浏览公开菜谱</button><Link className="btn btn-secondary" href="/imports">从来源视频开始整理</Link></div></div>}
    </>:<>
      <div className="section-head"><h2>{publicLoading?"正在读取…":`${publicFiltered.length} 道公开菜`}</h2><span className="subtitle">公开版本是审核通过时的快照，不包含私人日志、审核证据或导入原始数据。</span></div>
      {publicError&&<div className="notice" style={{marginBottom:16,background:"#fbe5de",color:"#923c29"}}>{publicError}</div>}
      {!publicLoading&&(publicFiltered.length?<div className="recipe-grid">{publicFiltered.map(item=><RecipeCard key={item.recipeId} recipe={item.recipe} href={`/recipes/public/${encodeURIComponent(item.recipeId)}`}/>)}</div>:<div className="panel empty"><span>📖</span><h2>暂时没有匹配的公开菜谱</h2><p>{publicRecipes.length?"换一个关键词试试。":"管理员审核通过菜谱后，它们会出现在这里。"}</p></div>)}
    </>}
  </div>;
}
