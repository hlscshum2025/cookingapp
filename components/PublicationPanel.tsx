"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isRecipePublished, loadMyPublicationRequests, submitRecipePublication } from "@/lib/public-recipes";
import type { PublicationRequest } from "@/lib/types";

const statusLabel={pending:"待管理员审核",approved:"已通过",rejected:"未通过"} as const;

export function PublicationPanel({recipeId}:{recipeId:string}){
  const [requests,setRequests]=useState<PublicationRequest[]>([]);
  const [published,setPublished]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const refresh=useCallback(async()=>{
    setLoading(true);setMessage("");
    try{
      const [rows,isPublished]=await Promise.all([loadMyPublicationRequests(recipeId),isRecipePublished(recipeId)]);
      setRequests(rows);setPublished(isPublished);
    }catch(reason){setMessage(reason instanceof Error?reason.message:"公开状态读取失败。");}
    finally{setLoading(false);}
  },[recipeId]);
  useEffect(()=>{void refresh();},[refresh]);

  const latest=requests[0];
  const pending=useMemo(()=>requests.find(item=>item.status==="pending"),[requests]);

  const submit=async()=>{
    if(pending)return;
    if(!window.confirm(published?"提交当前版本重新审核吗？审核通过前，现有公开版本会继续保持不变。":"确认申请把这道菜发布到公开菜谱库吗？系统只会提交食材、步骤、标签和来源等白名单字段，不会提交私人日志。"))return;
    setBusy(true);setMessage("");
    try{await submitRecipePublication(recipeId);setMessage("已提交公开申请，等待管理员审核。");await refresh();}
    catch(reason){setMessage(reason instanceof Error?reason.message:"提交失败，请稍后重试。");}
    finally{setBusy(false);}
  };

  return <div className="panel" style={{marginTop:18}}>
    <div className="section-head" style={{marginTop:0}}><h2>公开菜谱</h2>{published&&<span className="badge">已公开</span>}</div>
    {loading?<p className="subtitle">正在读取公开状态…</p>:<>
      {published?<p className="subtitle">当前已有管理员审核通过的公开快照。你之后编辑私人菜谱不会直接改变公开版本；如需更新，重新提交审核即可。</p>:<p className="subtitle">当前仍是私人菜谱。提交后由管理员审核，通过后才会进入公开菜谱库。</p>}
      {pending?<div className="notice" style={{marginTop:14}}><b>待管理员审核</b><br/>提交于 {new Date(pending.submittedAt).toLocaleString("zh-CN")}。审核完成前不能重复提交。</div>:<button type="button" className="btn btn-primary" style={{width:"100%",marginTop:14}} onClick={submit} disabled={busy}>{busy?"正在提交…":published?"提交当前版本重新审核":"申请发布到公开菜谱库"}</button>}
      {published&&<Link className="btn btn-secondary" style={{width:"100%",marginTop:9}} href={`/recipes/public/${encodeURIComponent(recipeId)}`}>查看当前公开版本</Link>}
      {!pending&&latest?.status==="rejected"&&<div className="notice" style={{marginTop:12,background:"#fbe5de",color:"#923c29"}}><b>{statusLabel[latest.status]}</b>{latest.reviewNote&&<><br/>{latest.reviewNote}</>}</div>}
    </>}
    {message&&<div className="notice" style={{marginTop:12}}>{message}</div>}
  </div>;
}
