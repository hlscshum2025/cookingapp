"use client";

import {useEffect,useMemo,useState} from "react";
import {createOcrJob,getOcrJob} from "@/lib/ocr-client";
import type {OcrJobV1,ReceiptOcrBatchDraftV1,RecipeScreenshotDraftV1} from "@/lib/vision-contracts";

const statusLabel={queued:"等待处理",running:"正在识别",review_required:"等待人工确认",failed:"识别失败"};

export function OcrImportPanel(){
  const [kind,setKind]=useState<"receipt"|"xiaohongshu">("receipt");
  const [files,setFiles]=useState<File[]>([]);
  const [job,setJob]=useState<OcrJobV1|null>(null);
  const [error,setError]=useState("");
  const busy=job?.status==="queued"||job?.status==="running";
  const previews=useMemo(()=>files.map(file=>({name:file.name,url:URL.createObjectURL(file)})),[files]);
  useEffect(()=>()=>previews.forEach(item=>URL.revokeObjectURL(item.url)),[previews]);
  useEffect(()=>{
    if(!job||!busy)return;
    const timer=window.setInterval(()=>void getOcrJob(job.id).then(setJob).catch(reason=>setError(reason instanceof Error?reason.message:"任务读取失败")),2000);
    return()=>window.clearInterval(timer);
  },[job,busy]);

  const submit=async()=>{
    if(!files.length)return;
    setError("");
    try{setJob(await createOcrJob(kind,files));}
    catch(reason){setError(reason instanceof Error?reason.message:"OCR任务创建失败");}
  };
  const move=(index:number,direction:-1|1)=>{
    setFiles(current=>{
      const target=index+direction;if(target<0||target>=current.length)return current;
      const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next;
    });
  };

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">OCR IMPORT</p><h1>图片文字识别</h1><p className="subtitle">长小票和长笔记都可以按从上到下的顺序上传多张图片；结果只生成待确认草稿。</p></div>{job&&<span className="badge">{statusLabel[job.status]}</span>}</header>
    {error&&<div className="notice notice-error" role="alert">{error}</div>}
    <section className="panel">
      <div className="field"><label>识别类型</label><select value={kind} disabled={busy} onChange={event=>{setKind(event.target.value as typeof kind);setFiles([]);setJob(null);}}><option value="receipt">德国小票</option><option value="xiaohongshu">小红书菜谱截图</option></select></div>
      <div className="dropzone"><b>按页面顺序选择 1–12 张图片</b><p className="subtitle">单张不超过15MB，支持 JPEG、PNG、WebP。重叠区域会在页间去重。</p><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>setFiles(Array.from(event.target.files||[]).slice(0,12))}/></div>
      {previews.length>0&&<div className="source-preview-list">{previews.map((item,index)=><div key={`${item.name}-${index}`}><b>第 {index+1} 张 · {item.name}</b><span>{Math.ceil(files[index].size/1024)} KB　<button type="button" disabled={busy||index===0} onClick={()=>move(index,-1)}>上移</button>　<button type="button" disabled={busy||index===files.length-1} onClick={()=>move(index,1)}>下移</button></span></div>)}</div>}
      <button type="button" className="btn btn-primary" disabled={!files.length||busy} onClick={()=>void submit()}>{busy?"OCR worker 正在处理…":"创建识别任务"}</button>
    </section>
    {job?.status==="failed"&&<div className="notice notice-error">{job.error||"识别失败，请重新上传。"}</div>}
    {job?.status==="review_required"&&job.result&&<OcrReview result={job.result}/>} 
  </div>;
}

function OcrReview({result}:{result:OcrJobV1["result"]}){
  if(!result)return null;
  if(result.schema_version==="receipt-ocr-batch-v1"){
    const draft=result as ReceiptOcrBatchDraftV1;
    const items=draft.pages.flatMap(page=>page.items);
    return <section className="panel"><div className="section-head"><div><p className="eyebrow">REVIEW REQUIRED</p><h2>小票识别草稿</h2></div><span className="badge">{draft.pages.length} 页 · {items.length} 项</span></div>{draft.warnings.map(message=><div className="notice" key={message}>{message}</div>)}<div className="source-list">{items.map((item,index)=><div key={`${item.raw_text}-${index}`}><b>{item.product_name||item.raw_text}</b><small>{item.line_total==null?"价格待补充":`${item.currency} ${item.line_total.toFixed(2)}`} · 置信度 {Math.round(item.confidence*100)}%</small></div>)}</div><div className="notice">第一版暂不直接写入粮仓或记账；确认事务将在下一步接入。</div></section>;
  }
  const draft=result as RecipeScreenshotDraftV1;
  return <section className="panel"><div className="section-head"><div><p className="eyebrow">REVIEW REQUIRED</p><h2>{draft.title||"菜谱标题待补充"}</h2><p className="subtitle">{draft.author||"作者待补充"}</p></div><span className="badge">{draft.pages.length} 页</span></div><h3>食材</h3><div className="source-list">{draft.ingredients.map((item,index)=><div key={`${item.raw_text}-${index}`}><b>{item.name||item.raw_text}</b><small>{item.amount_text||"用量待补充"}</small></div>)}</div><h3>步骤</h3><ol>{draft.steps.map((step,index)=><li key={`${step.raw_text}-${index}`}>{step.raw_text}</li>)}</ol><div className="notice">这是未确认草稿，不会自动覆盖正式菜谱。</div></section>;
}
