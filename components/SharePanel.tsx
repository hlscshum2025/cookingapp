"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function SharePanel({recipeId,isPublic}:{recipeId:string;isPublic:boolean}){const [url,setUrl]=useState("");const [copied,setCopied]=useState(false);useEffect(()=>{const timer=window.setTimeout(()=>setUrl(`${window.location.origin}/share/${recipeId}`),0);return()=>window.clearTimeout(timer)},[recipeId]);return <div className="panel" style={{marginTop:18}}><h2>只读分享</h2>{isPublic?<><p className="subtitle">对方只能看到公开菜谱，不会看到制作日志和导入原始数据。</p>{url&&<div style={{display:"grid",placeItems:"center",padding:16,background:"white",borderRadius:14,marginTop:12}}><QRCodeSVG value={url} size={148} bgColor="#ffffff" fgColor="#24322b" level="M"/></div>}<button className="btn btn-secondary" style={{width:"100%",marginTop:10}} onClick={async()=>{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1500)}}>{copied?"已复制链接":"复制分享链接"}</button></>:<div className="notice">当前是私密菜谱。先在“编辑 → 可见范围”中改为公开，分享页才会生效。</div>}</div>}
