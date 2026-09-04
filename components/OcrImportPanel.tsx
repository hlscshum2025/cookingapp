"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {createOcrJob,getOcrJob,listRecentOcrJobs} from "@/lib/ocr-client";
import type {OcrJobV1,ReceiptOcrBatchDraftV1,RecipeScreenshotDraftV1} from "@/lib/vision-contracts";

const statusLabel={uploading:"正在上传",queued:"等待管理员处理",processing:"正在识别",running:"正在识别",review_required:"等待人工确认",completed:"已完成",failed:"识别失败",cancelled:"已取消"};

type OcrImportPanelProps={
  initialKind?:"receipt"|"xiaohongshu";
  lockedKind?:boolean;
  embedded?:boolean;
  onReceiptDraft?:(draft:ReceiptOcrBatchDraftV1)=>void;
  onRecipeDraft?:(draft:RecipeScreenshotDraftV1)=>void;
};

export function OcrImportPanel({initialKind="receipt",lockedKind=false,embedded=false,onReceiptDraft,onRecipeDraft}:OcrImportPanelProps){
  const [kind,setKind]=useState<"receipt"|"xiaohongshu">(initialKind);
  const [files,setFiles]=useState<File[]>([]);
  const [job,setJob]=useState<OcrJobV1|null>(null);
  const [recentJobs,setRecentJobs]=useState<OcrJobV1[]>([]);
  const [error,setError]=useState("");
  const deliveredJob=useRef("");
  const busy=job?.status==="uploading"||job?.status==="queued"||job?.status==="processing"||job?.status==="running";
  const previews=useMemo(()=>files.map(file=>({name:file.name,url:URL.createObjectURL(file)})),[files]);
  useEffect(()=>()=>previews.forEach(item=>URL.revokeObjectURL(item.url)),[previews]);
  useEffect(()=>{
    let active=true;
    void listRecentOcrJobs(kind).then(items=>{
      if(!active)return;
      setRecentJobs(items);
      setJob(current=>current||items.find(item=>["uploading","queued","processing","running","review_required"].includes(item.status))||null);
    }).catch(()=>undefined);
    return()=>{active=false;};
  },[kind]);
  useEffect(()=>{
    if(!job||!busy)return;
    const timer=window.setInterval(()=>void getOcrJob(job.id).then(next=>{
      setJob(next);
      setRecentJobs(current=>[next,...current.filter(item=>item.id!==next.id)].slice(0,8));
    }).catch(reason=>setError(reason instanceof Error?reason.message:"任务读取失败")),5000);
    return()=>window.clearInterval(timer);
  },[job,busy]);
  useEffect(()=>{
    if(!job?.result||job.status!=="review_required"||deliveredJob.current===job.id)return;
    deliveredJob.current=job.id;
    if(job.result.schema_version==="receipt-ocr-batch-v1")onReceiptDraft?.(job.result);
  },[job,onReceiptDraft]);

  const submit=async()=>{
    if(!files.length)return;
    setError("");
    try{
      const created=await createOcrJob(kind,files);
      setJob(created);
      setRecentJobs(current=>[created,...current.filter(item=>item.id!==created.id)].slice(0,8));
    }
    catch(reason){setError(reason instanceof Error?reason.message:"OCR任务创建失败");}
  };
  const move=(index:number,direction:-1|1)=>{
    setFiles(current=>{
      const target=index+direction;if(target<0||target>=current.length)return current;
      const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next;
    });
  };

  const body=<>
    <header className={embedded?"section-head":"page-head"}><div><p className="eyebrow">OCR IMPORT</p><h1>{initialKind==="xiaohongshu"?"小红书截图识别":"小票图片识别"}</h1><p className="subtitle">长小票和长笔记都可以按从上到下的顺序上传多张图片；图片进入私有处理队列，结果只生成待确认草稿。</p></div>{job&&<span className="badge">{statusLabel[job.status]}</span>}</header>
    {error&&<div className="notice notice-error" role="alert">{error}</div>}
    <section className="panel">
      {!lockedKind&&<div className="field"><label>识别类型</label><select value={kind} disabled={busy} onChange={event=>{setKind(event.target.value as typeof kind);setFiles([]);setJob(null);}}><option value="receipt">德国小票</option><option value="xiaohongshu">小红书菜谱截图</option></select></div>}
      {recentJobs.length>0&&<div className="field"><label>最近任务</label><select value={job?.id||""} onChange={event=>setJob(recentJobs.find(item=>item.id===event.target.value)||null)}><option value="">选择历史任务</option>{recentJobs.map(item=><option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleString("zh-CN")} · {statusLabel[item.status]}</option>)}</select></div>}
      <div className="dropzone"><b>按页面顺序选择 1–12 张图片</b><p className="subtitle">单张不超过15MB，支持 JPEG、PNG、WebP。重叠区域会在页间去重。</p><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>setFiles(Array.from(event.target.files||[]).slice(0,12))}/></div>
      {previews.length>0&&<div className="source-preview-list">{previews.map((item,index)=><div key={`${item.name}-${index}`}><b>第 {index+1} 张 · {item.name}</b><span>{Math.ceil(files[index].size/1024)} KB　<button type="button" disabled={busy||index===0} onClick={()=>move(index,-1)}>上移</button>　<button type="button" disabled={busy||index===files.length-1} onClick={()=>move(index,1)}>下移</button></span></div>)}</div>}
      <button type="button" className="btn btn-primary" disabled={!files.length||busy} onClick={()=>void submit()}>{busy?statusLabel[job!.status]:"上传并加入处理队列"}</button>
    </section>
    {job?.status==="queued"&&<div className="notice"><b>图片已安全提交。</b> 你现在可以关闭页面；管理员本地worker下次运行时会自动处理，完成后回到这里查看结果。</div>}
    {job?.status==="failed"&&<div className="notice notice-error">{job.error||"识别失败，请重新上传。"}</div>}
    {job?.status==="review_required"&&job.result&&<OcrReview result={job.result} totalMs={Math.max(0,Date.parse(job.updated_at)-Date.parse(job.created_at))} onRecipeDraft={onRecipeDraft}/>} 
  </>;
  return embedded?<div className="ocr-embedded">{body}</div>:<div className="page">{body}</div>;
}

function OcrReview({result,totalMs,onRecipeDraft}:{result:OcrJobV1["result"];totalMs:number;onRecipeDraft?:OcrImportPanelProps["onRecipeDraft"]}){
  if(!result)return null;
  const modelSeconds=result.latency_ms==null?"未知":`${(result.latency_ms/1000).toFixed(1)} 秒`;
  const totalSeconds=`${(totalMs/1000).toFixed(1)} 秒`;
  if(result.schema_version==="receipt-ocr-batch-v1"){
    const draft=result as ReceiptOcrBatchDraftV1;
    const items=draft.pages.flatMap(page=>page.items);
    return <section className="panel"><div className="section-head"><div><p className="eyebrow">REVIEW REQUIRED</p><h2>小票识别草稿</h2><p className="subtitle">模型处理 {modelSeconds} · 上传、排队和处理总计 {totalSeconds}</p></div><span className="badge">{draft.pages.length} 页 · {items.length} 项</span></div>{draft.warnings.map(message=><div className="notice" key={message}>{message}</div>)}<div className="source-list">{items.map((item,index)=><div key={`${item.raw_text}-${index}`}><b>{item.product_name||item.raw_text}</b><small>{item.line_total==null?"价格待补充":`${item.currency} ${item.line_total.toFixed(2)}`} · 置信度 {Math.round(item.confidence*100)}%</small></div>)}</div><div className="notice">第一版暂不直接写入粮仓或记账；确认事务将在下一步接入。</div></section>;
  }
  const draft=result as RecipeScreenshotDraftV1;
  return <section className="panel"><div className="section-head"><div><p className="eyebrow">REVIEW REQUIRED</p><h2>{draft.title||"菜谱标题待补充"}</h2><p className="subtitle">{draft.author||"作者待补充"} · 模型处理 {modelSeconds} · 总计 {totalSeconds}</p></div><span className="badge">{draft.pages.length} 页</span></div><h3>食材</h3><div className="source-list">{draft.ingredients.map((item,index)=><div key={`${item.raw_text}-${index}`}><b>{item.name||item.raw_text}</b><small>{item.amount_text||"用量待补充"}</small></div>)}</div><h3>步骤</h3><ol>{draft.steps.map((step,index)=><li key={`${step.raw_text}-${index}`}>{step.raw_text}</li>)}</ol><div className="notice">这是未确认草稿，不会自动覆盖正式菜谱。</div>{onRecipeDraft&&<button type="button" className="btn btn-primary" onClick={()=>onRecipeDraft(draft)}>带入菜谱录入表 →</button>}</section>;
}
