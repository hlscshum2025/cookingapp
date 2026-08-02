"use client";

import { useParams } from "next/navigation";
import { useCooking } from "@/components/CookingProvider";
import { useEffect, useState } from "react";
import { getPublicRecipe } from "@/lib/supabase";
import type { Recipe } from "@/lib/types";

export default function SharePage(){const {id}=useParams<{id:string}>();const {recipes,ready}=useCooking();const [remote,setRemote]=useState<Recipe|null>(null);const local=recipes.find(x=>x.id===id&&x.visibility==="public");useEffect(()=>{if(!local)getPublicRecipe(id).then(r=>setRemote(r||null)).catch(()=>setRemote(null));},[id,local]);const r=local||remote;if(!r)return <div className="page"><div className="panel empty"><span>🔒</span>{ready?"分享链接不存在、未公开或已失效。":"正在读取分享菜谱…"}</div></div>;return <div className="page" style={{maxWidth:880}}><header className="page-head"><div><p className="eyebrow">COOKINGAPP · 只读分享</p><h1>{r.title}</h1><p className="subtitle">{r.summary}</p></div></header><div className="detail-cover" style={{background:r.color}}>{r.emoji}</div><div className="two-col" style={{marginTop:18}}><section className="panel"><h2>步骤</h2><ol className="step-list">{r.steps.map((s,i)=><li className="step-item" key={s.id}><span className="step-no">{i+1}</span><p>{s.instruction}</p></li>)}</ol></section><aside className="panel"><h2>食材 · {r.servings} 人份</h2><ul className="ingredient-list">{r.ingredients.map(i=><li key={i.id}><span>{i.name}</span><b>{i.amount} {i.unit}</b></li>)}</ul><div className="notice" style={{marginTop:16}}>此页面不包含私人制作日志或导入原始数据。健康与过敏原信息请以产品包装和专业意见为准。</div></aside></div></div>}
