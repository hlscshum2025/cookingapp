"use client";

import {useCallback,useEffect,useState} from "react";
import {useCooking} from "./CookingProvider";
import {
  listQueuedManualEntries,
  MANUAL_ENTRY_QUEUE_EVENT,
  markQueuedManualEntryFailed,
  removeQueuedManualEntry,
  type QueuedManualEntry,
} from "@/lib/manual-entry-queue";
import {persistManualEntry} from "@/lib/supabase";

const platformLabel=(platform:string)=>({bilibili:"Bilibili",xiachufang:"下厨房",xiaohongshu:"小红书",generic_web:"网页",manual:"手动"}[platform]||platform);

export function ManualUploadQueue({onUploaded}:{onUploaded?:()=>void|Promise<void>}){
  const {currentUserId,cloudStatus,refreshCloudData}=useCooking();
  const [entries,setEntries]=useState<QueuedManualEntry[]>([]);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [batchTotal,setBatchTotal]=useState(0);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    if(!currentUserId){setEntries([]);return;}
    try{setEntries(await listQueuedManualEntries(currentUserId));}
    catch(reason){setError(reason instanceof Error?reason.message:"本机队列读取失败。");}
  },[currentUserId]);

  useEffect(()=>{
    const initial=window.setTimeout(()=>{void refresh();},0);
    const changed=()=>{void refresh();};
    window.addEventListener(MANUAL_ENTRY_QUEUE_EVENT,changed);
    window.addEventListener("storage",changed);
    return()=>{window.clearTimeout(initial);window.removeEventListener(MANUAL_ENTRY_QUEUE_EVENT,changed);window.removeEventListener("storage",changed);};
  },[refresh]);

  const remove=(entry:QueuedManualEntry)=>{
    if(!currentUserId||!window.confirm(`确认从本机待上传队列移除“${entry.payload.recipe.title}”吗？\n\n这不会删除已经上传到云端的菜谱。`))return;
    void removeQueuedManualEntry(currentUserId,entry.id).catch(reason=>setError(reason instanceof Error?reason.message:"本机队列移除失败。"));
  };

  const uploadAll=async()=>{
    if(!currentUserId||!entries.length)return;
    if(cloudStatus!=="connected"){
      setError("Supabase 当前未连接。队列仍保存在本机，连接恢复后再上传即可。");
      return;
    }
    const uploadEntries=entries.slice().reverse();
    setBusy(true);setProgress(0);setBatchTotal(uploadEntries.length);setMessage("");setError("");
    let uploaded=0;
    const failures:string[]=[];
    for(const entry of uploadEntries){
      try{
        const result=await persistManualEntry(entry.payload);
        if(!result)throw new Error("没有收到云端保存结果。");
        await removeQueuedManualEntry(currentUserId,entry.id);
        uploaded+=1;
      }catch(reason){
        const detail=reason instanceof Error?reason.message:"上传失败";
        await markQueuedManualEntryFailed(currentUserId,entry.id,detail);
        failures.push(`${entry.payload.recipe.title}：${detail}`);
      }finally{
        setProgress(value=>value+1);
      }
    }
    try{
      if(uploaded){await refreshCloudData();await onUploaded?.();}
    }catch(reason){failures.push(reason instanceof Error?reason.message:"云端列表刷新失败");}
    await refresh();
    if(uploaded)setMessage(`已上传 ${uploaded} 道菜谱；成功项目已从本机队列移除。`);
    if(failures.length)setError(`有 ${failures.length} 项仍留在本机队列：${failures.slice(0,3).join("；")}`);
    setBusy(false);
  };

  return <section className="panel manual-upload-queue" aria-labelledby="manual-upload-queue-title">
    <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">LOCAL UPLOAD QUEUE</p><h2 id="manual-upload-queue-title">本机待上传菜谱</h2><p className="subtitle">先连续整理多道下厨房或其他来源菜谱，再一次上传。队列按当前账号隔离，只保存在这台设备的这个浏览器中。</p></div><span className="badge">{entries.length} 道</span></div>
    {entries.length?<>
      <div className="source-preview-list manual-upload-queue-list">{entries.map(entry=><div key={entry.id}><span><b>{entry.payload.recipe.title}</b><small>{platformLabel(entry.payload.source.platform)} · {new Date(entry.updatedAt).toLocaleString("zh-CN")}{entry.lastError?` · 上次失败：${entry.lastError}`:""}</small></span><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>remove(entry)}>移除</button></div>)}</div>
      <button type="button" className="btn btn-primary import-save" disabled={busy||cloudStatus!=="connected"} onClick={()=>void uploadAll()}>{busy?`正在上传 ${Math.min(progress+1,batchTotal)} / ${batchTotal}…`:`一键上传全部 ${entries.length} 道`}</button>
      {cloudStatus!=="connected"&&<div className="notice" style={{marginTop:10}}>当前未连接 Supabase；菜谱不会丢失，恢复连接后再上传。</div>}
    </>:<div className="empty compact-empty"><span>✓</span><p>本机队列为空。进入下方来源，核验后点击“存入本机待上传”即可连续积累。</p></div>}
    {message&&<div className="notice notice-success" role="status" style={{marginTop:10}}>{message}</div>}
    {error&&<div className="notice notice-error" role="alert" style={{marginTop:10}}>{error}</div>}
  </section>;
}
