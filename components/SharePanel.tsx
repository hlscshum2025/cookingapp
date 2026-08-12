"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { isRecipePublished } from "@/lib/public-recipes";

export function SharePanel({recipeId}:{recipeId:string}){
  const [url,setUrl]=useState("");
  const [copied,setCopied]=useState(false);
  const [published,setPublished]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const timer=window.setTimeout(()=>setUrl(`${window.location.origin}/share/${recipeId}`),0);
    void isRecipePublished(recipeId).then(setPublished).catch(()=>setPublished(false)).finally(()=>setLoading(false));
    return()=>window.clearTimeout(timer);
  },[recipeId]);

  return <div className="panel" style={{marginTop:18}}><h2>只读分享</h2>{loading?<p className="subtitle">正在检查公开状态…</p>:published?<><p className="subtitle">分享页读取的是管理员审核通过的公开快照，不会看到你的制作日志、版本说明和导入原始数据。</p>{url&&<div style={{display:"grid",placeItems:"center",padding:16,background:"white",borderRadius:14,marginTop:12}}><QRCodeSVG value={url} size={148} bgColor="#ffffff" fgColor="#24322b" level="M"/></div>}<button className="btn btn-secondary" style={{width:"100%",marginTop:10}} onClick={async()=>{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1500)}}>{copied?"已复制链接":"复制分享链接"}</button></>:<div className="notice">这道菜还没有管理员审核通过的公开版本。请先在上方“公开菜谱”区域提交审核。</div>}</div>;
}
