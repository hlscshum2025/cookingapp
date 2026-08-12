"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadPublicRecipe } from "@/lib/public-recipes";
import type { Recipe } from "@/lib/types";

export default function SharePage(){
  const {id}=useParams<{id:string}>();
  const [recipe,setRecipe]=useState<Recipe|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true);
    void loadPublicRecipe(id).then(item=>setRecipe(item?.recipe||null)).catch(()=>setRecipe(null)).finally(()=>setLoading(false));
  },[id]);
  if(!recipe)return <div className="page"><div className="panel empty"><span>🔒</span>{loading?"正在读取分享菜谱…":"分享链接不存在、尚未审核公开或已经下架。"}</div></div>;
  const r=recipe;
  return <div className="page" style={{maxWidth:880}}><header className="page-head"><div><p className="eyebrow">COOKINGAPP · 管理员审核公开 · 只读分享</p><h1>{r.title}</h1><p className="subtitle">{r.summary}</p></div></header><div className="detail-cover" style={{background:r.color}}>{r.emoji}</div><div className="two-col" style={{marginTop:18}}><section className="panel"><h2>步骤</h2><ol className="step-list">{r.steps.map((s,i)=><li className="step-item" key={s.id}><span className="step-no">{i+1}</span><p>{s.instruction}</p></li>)}</ol></section><aside className="panel"><h2>食材 · {r.servings} 人份</h2><ul className="ingredient-list">{r.ingredients.map(i=><li key={i.id}><span>{i.name}</span><b>{i.amount} {i.unit}</b></li>)}</ul><div className="notice" style={{marginTop:16}}>此页面来自审核通过的公开快照，不包含私人制作日志、版本说明、字幕/OCR证据或导入原始数据。健康与过敏原信息请以产品包装和专业意见为准。</div></aside></div></div>;
}
