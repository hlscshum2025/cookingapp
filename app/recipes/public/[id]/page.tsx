"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SubpageBack } from "@/components/SubpageBack";
import { loadPublicRecipe } from "@/lib/public-recipes";
import type { PublicRecipe } from "@/lib/types";

export default function PublicRecipeDetailPage(){
  const {id}=useParams<{id:string}>();
  const [item,setItem]=useState<PublicRecipe|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    setLoading(true);setError("");
    void loadPublicRecipe(id)
      .then(setItem)
      .catch(reason=>setError(reason instanceof Error?reason.message:"公开菜谱读取失败。"))
      .finally(()=>setLoading(false));
  },[id]);

  if(loading)return <div className="page"><header className="page-head"><div><p className="eyebrow">PUBLIC RECIPE</p><h1>公开菜谱</h1></div></header><SubpageBack href="/recipes?scope=public" label="返回公开菜谱"/><div className="panel empty">正在读取公开菜谱…</div></div>;
  if(error||!item)return <div className="page"><header className="page-head"><div><p className="eyebrow">PUBLIC RECIPE</p><h1>公开菜谱</h1></div></header><SubpageBack href="/recipes?scope=public" label="返回公开菜谱"/><div className="panel empty"><span>🔒</span>{error||"这道公开菜谱不存在或已经下架。"}</div></div>;

  const recipe=item.recipe;
  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">PUBLIC RECIPE · 管理员已审核</p><h1>{recipe.title}</h1><p className="subtitle">{recipe.summary}</p></div><span className="badge">{item.publishedAt?new Date(item.publishedAt).toLocaleDateString("zh-CN"):"已公开"}</span></header>
    <SubpageBack href="/recipes?scope=public" label="返回公开菜谱"/>
    <div className="two-col"><section>
      <div className="detail-cover" style={{background:recipe.color}}>{recipe.emoji}</div>
      <div className="panel" style={{marginTop:18}}><div className="section-head"><h2>公开版本</h2><span className="badge">只读</span></div><div className="meta-row" style={{fontSize:13}}><span>◷ {recipe.totalMinutes||"?"} 分钟</span><span>♙ {recipe.servings} 人份</span><span>◇ {recipe.difficulty}</span></div><div className="tag-row">{recipe.tags.map(tag=><span className="tag" key={tag}>{tag}</span>)}</div></div>
      <div className="panel" style={{marginTop:18}}><h2>步骤</h2><ol className="step-list">{recipe.steps.length?recipe.steps.map((step,index)=><li className="step-item" key={step.id}><span className="step-no">{index+1}</span><div><p>{step.instruction}</p>{step.minutes&&<small>约 {step.minutes} 分钟</small>}{step.tip&&<div className="notice" style={{marginTop:8}}>{step.tip}</div>}</div></li>):<p className="subtitle">暂无公开步骤。</p>}</ol></div>
    </section><aside>
      <div className="panel"><h2>食材 · {recipe.servings} 人份</h2><ul className="ingredient-list">{recipe.ingredients.map(item=><li key={item.id}><span>{item.name}<br/><small>{item.preparation}</small></span><b>{item.amount} {item.unit}</b></li>)}</ul></div>
      {recipe.source&&<div className="panel" style={{marginTop:18}}><p className="eyebrow">SOURCE</p><h2>来源</h2><p className="subtitle">{recipe.source.title}</p><p className="subtitle">{recipe.source.uploader||""}</p>{recipe.source.url&&<a href={recipe.source.url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{marginTop:12}}>打开原来源 ↗</a>}</div>}
      <div className="notice" style={{marginTop:18}}>这是审核通过时生成的公开快照。原作者账号里的做菜日志、版本说明、导入原始数据和审核证据不会公开。</div>
      <Link className="btn btn-secondary" style={{width:"100%",marginTop:12}} href={`/share/${encodeURIComponent(recipe.id)}`}>打开只读分享页</Link>
    </aside></div>
  </div>;
}
