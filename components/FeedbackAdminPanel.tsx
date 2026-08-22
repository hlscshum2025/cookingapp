"use client";

import { useEffect, useState } from "react";
import { loadFeedbackQueue, reviewFeedback, type FeedbackPriority, type FeedbackStatus, type FeedbackSubmission } from "@/lib/feedback";
import { getCurrentAppRole } from "@/lib/roles";

export function FeedbackAdminPanel(){
  const [role,setRole]=useState<"loading"|"user"|"admin">("loading");
  const [items,setItems]=useState<FeedbackSubmission[]>([]);
  const [message,setMessage]=useState("");

  useEffect(()=>{void getCurrentAppRole().then(async current=>{setRole(current);if(current==="admin")setItems(await loadFeedbackQueue());}).catch(()=>setRole("user"));},[]);
  if(role!=="admin")return null;
  const update=async(item:FeedbackSubmission,status:FeedbackStatus,priority:FeedbackPriority)=>{
    setMessage("");
    try{await reviewFeedback(item.id,{status,priority,adminNote:item.adminNote});setItems(current=>current.map(row=>row.id===item.id?{...row,status,priority}:row));setMessage("反馈状态已保存。");}
    catch(error){setMessage(error instanceof Error?error.message:"保存失败。");}
  };

  return <section className="panel feedback-admin-panel">
    <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">ADMIN ONLY</p><h2>问题反馈审核区</h2><p className="subtitle">这里显示全部用户反馈；普通用户只能看到自己的提交。</p></div><span className="badge">{items.length} 条</span></div>
    {message&&<div className="notice" role="status">{message}</div>}
    <div className="feedback-admin-list">{items.map(item=><article key={item.id}>
      <div><b>{item.title}</b><p>{item.details}</p><small>{item.category} · {new Date(item.createdAt).toLocaleString()}</small></div>
      <div className="feedback-admin-controls"><select value={item.priority} onChange={event=>void update(item,item.status,event.target.value as FeedbackPriority)} aria-label="优先级"><option value="p0">P0</option><option value="p1">P1</option><option value="p2">P2</option><option value="p3">P3</option></select><select value={item.status} onChange={event=>void update(item,event.target.value as FeedbackStatus,item.priority)} aria-label="处理状态"><option value="new">新建</option><option value="triaged">已分级</option><option value="planned">已排期</option><option value="resolved">已解决</option><option value="declined">不处理</option></select></div>
    </article>)}</div>
  </section>;
}
