"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCooking } from "@/components/CookingProvider";

export default function TagsPage(){const {recipes}=useCooking();const tags=useMemo(()=>{const count=new Map<string,number>();recipes.forEach(r=>r.tags.forEach(t=>count.set(t,(count.get(t)||0)+1)));return [...count.entries()].sort((a,b)=>b[1]-a[1]);},[recipes]);return <div className="page"><header className="page-head"><div><p className="eyebrow">TAG MANAGER</p><h1>标签总览</h1><p className="subtitle">标签不是互斥文件夹；一道菜可以同时属于餐次、方法、目标和状态。</p></div></header><div className="panel"><div className="tag-row" style={{gap:12}}>{tags.map(([tag,count])=><Link key={tag} href={`/recipes?q=${encodeURIComponent(tag)}`} className="tag" style={{fontSize:13,padding:"10px 13px"}}>{tag} · {count}</Link>)}</div>{!tags.length&&<div className="empty">还没有标签。</div>}</div><div className="notice" style={{marginTop:16}}>新增或修改标签请进入对应菜谱的编辑页。后续多人版本再增加独立合并、改名和权限管理。</div></div>}
