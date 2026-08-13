"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCooking } from "@/components/CookingProvider";
import { RecipeCard } from "@/components/RecipeCard";
import { loadPublicRecipes, togglePublicRecipeLike } from "@/lib/public-recipes";
import { getCurrentAppRole } from "@/lib/roles";
import type { AppRole } from "@/lib/permissions";
import type { PublicRecipe } from "@/lib/types";

type LibraryScope="mine"|"public";

export default function RecipesPage() {
  const {recipes,logs,cloudStatus}=useCooking();
  const params=useSearchParams();
  const [scope,setScope]=useState<LibraryScope>(()=>params.get("scope")==="public"?"public":"mine");
  const [query,setQuery]=useState(()=>params.get("q")||"");
  const [status,setStatus]=useState(()=>params.get("status")||"all");
  const [publicRecipes,setPublicRecipes]=useState<PublicRecipe[]>([]);
  const [publicLoading,setPublicLoading]=useState(false);
  const [publicError,setPublicError]=useState("");
  const [likeBusy,setLikeBusy]=useState<string[]>([]);
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

  const latestPhotoByRecipe=useMemo(()=>{
    const map=new Map<string,string>();
    for(const log of logs){
      if(log.photoUrl&&!map.has(log.recipeId))map.set(log.recipeId,log.photoUrl);
    }
    return map;
  },[logs]);

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
  const toggleLike=async(item:PublicRecipe)=>{
    if(likeBusy.includes(item.recipeId))return;
    setLikeBusy(current=>[...current,item.recipeId]);
    setPublicError("");
    try{
      const nextLiked=await togglePublicRecipeLike(item.recipeId,item.likedByMe);
      setPublicRecipes(current=>current.map(value=>value.recipeId===item.recipeId?{
        ...value,
        likedByMe:nextLiked,
        likeCount:Math.max(0,value.likeCount+(nextLiked&&!value.likedByMe?1:!nextLiked&&value.likedByMe?-1:0)),
      }:value));
    }catch(reason){
      setPublicError(reason instanceof Error?reason.message:"点赞失败，请稍后重试。");
    }finally{
      setLikeBusy(current=>current.filter(id=>id!==item.recipeId));
    }
  };

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
      <div className="section-head"><h2>{myFiltered.length} 道我的菜</h2><span className="subtitle">做菜日志里有成品照片时，卡片会自动使用最近一张；没有照片则显示来源封面或默认色块。</span></div>
      {myFiltered.length?<div className="recipe-grid">{myFiltered.map(r=><RecipeCard key={r.id} recipe={r} coverUrl={latestPhotoByRecipe.get(r.id)}/>)}</div>:recipes.length?<div className="panel empty"><span>🥕</span>没有找到匹配菜谱，换一个关键词试试。</div>:<div className="panel empty"><span>🍳</span><h2>你的个人菜谱库还是空的</h2><p>可以自己新建，也可以先看看管理员审核过的公开菜谱。</p><div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:16}}><button className="btn btn-primary" onClick={()=>switchScope("public")}>浏览公开菜谱</button><Link className="btn btn-secondary" href="/imports">从来源视频开始整理</Link></div></div>}
    </>:<>
      <div className="section-head"><h2>{publicLoading?"正在读取…":`${publicFiltered.length} 道公开菜`}</h2><span className="subtitle">按点赞数优先展示；每个账号对同一道菜最多一个红心，可以随时取消。</span></div>
      {publicError&&<div className="notice" style={{marginBottom:16,background:"#fbe5de",color:"#923c29"}}>{publicError}</div>}
      {!publicLoading&&(publicFiltered.length?<div className="recipe-grid">{publicFiltered.map(item=><RecipeCard key={item.recipeId} recipe={item.recipe} href={`/recipes/public/${encodeURIComponent(item.recipeId)}`} publicCard likeCount={item.likeCount} liked={item.likedByMe} likeBusy={likeBusy.includes(item.recipeId)} onToggleLike={()=>void toggleLike(item)}/>)}</div>:<div className="panel empty"><span>📖</span><h2>暂时没有匹配的公开菜谱</h2><p>{publicRecipes.length?"换一个关键词试试。":"管理员审核通过菜谱后，它们会出现在这里。"}</p></div>)}
    </>}
  </div>;
}
