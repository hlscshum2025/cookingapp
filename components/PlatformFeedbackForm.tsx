"use client";

import { useEffect, useState } from "react";
import { loadMyFeedback, submitFeedback, type FeedbackSubmission } from "@/lib/feedback";

export function PlatformFeedbackForm(){
  const [platform,setPlatform]=useState("");
  const [reason,setReason]=useState("");
  const [exampleUrl,setExampleUrl]=useState("");
  const [history,setHistory]=useState<FeedbackSubmission[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void loadMyFeedback().then(setHistory).catch(()=>setHistory([]));},[]);
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setMessage("");
    try{
      const created=await submitFeedback({category:"platform_request",title:`新增导入平台：${platform}`,details:reason,context:{exampleUrl:exampleUrl.trim()||null,source:"import_center"}});
      setHistory(current=>[created,...current]);setPlatform("");setReason("");setExampleUrl("");setMessage("建议已进入反馈队列。管理员审核后，会把确认采用的需求同步到 99 反馈记录与版本路线图。");
    }catch(error){setMessage(error instanceof Error?error.message:"提交失败，请稍后重试。");}
    finally{setBusy(false);}
  };

  return <section className="platform-feedback-layout">
    <form className="panel platform-feedback-form" onSubmit={submit}>
      <p className="eyebrow">PLATFORM REQUEST</p><h2>建议下一个导入平台</h2>
      <p className="subtitle">普通用户可以在这里提交建议；只有管理员能看到全体反馈、分级和调整状态。</p>
      <div className="field"><label>平台或软件名称</label><input required maxLength={80} value={platform} onChange={event=>setPlatform(event.target.value)} placeholder="例如：豆果美食、YouTube"/></div>
      <div className="field"><label>你希望导入什么内容</label><textarea required minLength={8} maxLength={2000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="例如：分享链接、视频、图片、收藏夹或完整菜谱正文"/></div>
      <div className="field"><label>示例链接（可选）</label><input type="url" maxLength={1000} value={exampleUrl} onChange={event=>setExampleUrl(event.target.value)} placeholder="https://…"/></div>
      <button className="btn btn-primary" disabled={busy}>{busy?"正在提交…":"提交平台建议"}</button>
      {message&&<div className="notice" role="status">{message}</div>}
    </form>
    <aside className="panel"><h2>我的最近反馈</h2><p className="subtitle">数据保存在 Supabase，不直接写入公开 GitHub。</p>{history.length?<div className="feedback-history">{history.map(item=><div key={item.id}><b>{item.title}</b><span>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</span></div>)}</div>:<div className="empty" style={{padding:"30px 0"}}>还没有提交记录。</div>}</aside>
  </section>;
}
