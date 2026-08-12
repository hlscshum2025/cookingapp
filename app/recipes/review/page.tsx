"use client";

import { useCallback, useEffect, useState } from "react";
import { SubpageBack } from "@/components/SubpageBack";
import { getCurrentAppRole } from "@/lib/roles";
import { loadPendingPublicationRequests, reviewPublicationRequest } from "@/lib/public-recipes";
import type { PublicationRequest } from "@/lib/types";

export default function PublicationReviewPage(){
  const [role,setRole]=useState<"admin"|"user">("user");
  const [checked,setChecked]=useState(false);
  const [items,setItems]=useState<PublicationRequest[]>([]);
  const [busyId,setBusyId]=useState("");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [message,setMessage]=useState("");

  const refresh=useCallback(async()=>{
    const currentRole=await getCurrentAppRole();
    setRole(currentRole);setChecked(true);
    if(currentRole!=="admin")return;
    try{setItems(await loadPendingPublicationRequests());}
    catch(reason){setMessage(reason instanceof Error?reason.message:"审核队列读取失败。");}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);

  const review=async(item:PublicationRequest,decision:"approved"|"rejected")=>{
    const wording=decision==="approved"?"通过并发布":"拒绝";
    if(!window.confirm(`确认${wording}“${item.title}”吗？`))return;
    setBusyId(item.id);setMessage("");
    try{await reviewPublicationRequest(item.id,decision,notes[item.id]||"");setMessage(decision==="approved"?"审核通过，公开快照已经发布。":"已拒绝申请，用户可以修改后重新提交。");await refresh();}
    catch(reason){setMessage(reason instanceof Error?reason.message:"审核操作失败。");}
    finally{setBusyId("");}
  };

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">ADMIN · PUBLICATION REVIEW</p><h1>公开菜谱审核</h1><p className="subtitle">这里只审核用户主动提交的公开快照。批准不会授予管理员查看用户私人日志或其他未提交数据的权限。</p></div></header>
    <SubpageBack href="/recipes?scope=public" label="返回菜谱库"/>
    {!checked?<div className="panel empty">正在检查管理员权限…</div>:role!=="admin"?<div className="panel empty"><span>🔒</span><h2>仅管理员可访问</h2><p>普通用户只能提交自己的公开申请，不能查看或审核其他用户的申请。</p></div>:<>
      {message&&<div className="notice" style={{marginBottom:16}}>{message}</div>}
      <div className="section-head"><h2>{items.length} 条待审核</h2><span className="subtitle">通过后进入公开菜谱库；拒绝后用户可修改并重新申请。</span></div>
      {items.length?<div style={{display:"grid",gap:16}}>{items.map(item=>{
        const recipe=item.recipe;
        return <section className="panel" key={item.id}>
          <div className="section-head" style={{marginTop:0,alignItems:"flex-start"}}><div><p className="eyebrow">提交于 {new Date(item.submittedAt).toLocaleString("zh-CN")}</p><h2 style={{marginBottom:7}}>{item.title}</h2><p className="subtitle">{item.summary||"没有填写摘要"}</p></div><span className="badge">待审核</span></div>
          <div className="meta-row" style={{fontSize:12}}><span>食材 {recipe.ingredients.length}</span><span>步骤 {recipe.steps.length}</span><span>标签 {recipe.tags.length}</span><span>{recipe.source?.uploader||"无来源作者"}</span></div>
          <div className="two-col" style={{gridTemplateColumns:"minmax(0,1fr) minmax(280px,.7fr)",marginTop:12}}><div><h3>食材预览</h3><ul className="ingredient-list">{recipe.ingredients.slice(0,12).map(line=><li key={line.id}><span>{line.name}</span><b>{line.amount} {line.unit}</b></li>)}</ul>{recipe.ingredients.length>12&&<small>还有 {recipe.ingredients.length-12} 项</small>}</div><div><h3>步骤预览</h3><ol style={{paddingLeft:20,margin:0,display:"grid",gap:8}}>{recipe.steps.slice(0,6).map(step=><li key={step.id}>{step.instruction}</li>)}</ol>{recipe.steps.length>6&&<small>还有 {recipe.steps.length-6} 步</small>}</div></div>
          <div className="field" style={{marginTop:16}}><label>审核备注（拒绝时建议填写原因）</label><textarea value={notes[item.id]||""} onChange={event=>setNotes(old=>({...old,[item.id]:event.target.value}))} placeholder="例如：食材用量缺失；来源链接需要核验；标题可再简化……"/></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14,flexWrap:"wrap"}}><button className="btn btn-danger" disabled={busyId===item.id} onClick={()=>review(item,"rejected")}>拒绝</button><button className="btn btn-primary" disabled={busyId===item.id} onClick={()=>review(item,"approved")}>{busyId===item.id?"正在处理…":"通过并发布"}</button></div>
        </section>;
      })}</div>:<div className="panel empty"><span>✓</span><h2>当前没有待审核申请</h2></div>}
    </>}
  </div>;
}
