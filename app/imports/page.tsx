"use client";

import { useState } from "react";
import { useCooking } from "@/components/CookingProvider";
import type { FavoriteVideo } from "@/lib/types";

function extractVideos(data:unknown):FavoriteVideo[]{
  if(Array.isArray(data)) return data as FavoriteVideo[];
  if(data&&typeof data==="object"){
    const obj=data as Record<string,unknown>;
    for(const key of ["videos","items","medias","favorites","data"]){const value=obj[key];if(Array.isArray(value))return value as FavoriteVideo[];if(value&&typeof value==="object"){const nested=value as Record<string,unknown>;for(const k of ["videos","items","medias","list"]){if(Array.isArray(nested[k]))return nested[k] as FavoriteVideo[];}}}
  }
  return [];
}

export default function ImportsPage(){
  const {recipes,importVideos}=useCooking();const [fileName,setFileName]=useState("");const [videos,setVideos]=useState<FavoriteVideo[]>([]);const [error,setError]=useState("");const [result,setResult]=useState<string>("");
  const existing=new Set(recipes.map(r=>r.source?.bvid));const duplicates=videos.filter(v=>existing.has(String(v.bvid||v.bvId||v.id))).length;
  const pick=async(file?:File)=>{if(!file)return;setError("");setResult("");setFileName(file.name);try{const parsed=JSON.parse(await file.text());const list=extractVideos(parsed);if(!list.length)throw new Error("没有识别到视频列表");setVideos(list);}catch(e){setVideos([]);setError(e instanceof Error?e.message:"JSON 读取失败");}};
  const confirm=()=>{const count=importVideos(videos);setResult(`已导入 ${count} 条；${videos.length-count} 条重复或已存在。`);};
  return <div className="page"><header className="page-head"><div><p className="eyebrow">BILIBILI IMPORT</p><h1>导入中心</h1><p className="subtitle">上传本地导出工具生成的 JSON；Cookie 和账号信息不会进入程序。</p></div></header><div className="two-col"><section className="panel"><h2>1. 选择导出文件</h2><div className="dropzone"><div style={{fontSize:44}}>⇩</div><b>选择“吃饭-日期.json”</b><p className="subtitle">支持导出工具生成的 videos / items / medias 结构</p><input type="file" accept="application/json,.json" onChange={e=>pick(e.target.files?.[0])}/></div>{error&&<div className="notice" style={{marginTop:14,background:"#fbe5de",color:"#923c29"}}>读取失败：{error}</div>}
      {videos.length>0&&<><div className="section-head"><h2>2. 导入预览</h2><span className="badge">{fileName}</span></div><div className="stats" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:18}}><div className="stat"><div className="stat-label">识别视频</div><div className="stat-value">{videos.length}</div></div><div className="stat"><div className="stat-label">可新建</div><div className="stat-value">{videos.length-duplicates}</div></div><div className="stat"><div className="stat-label">重复跳过</div><div className="stat-value">{duplicates}</div></div></div><div className="table-wrap"><table><thead><tr><th>标题</th><th>BV号</th><th>UP主</th><th>状态</th></tr></thead><tbody>{videos.slice(0,12).map((v,i)=>{const id=String(v.bvid||v.bvId||v.id||"");return <tr key={id||i}><td>{v.title||"未命名"}</td><td>{id||"缺失"}</td><td>{v.uploader||v.author||"—"}</td><td><span className={`badge ${existing.has(id)?"muted":""}`}>{existing.has(id)?"重复":"可导入"}</span></td></tr>})}</tbody></table></div>{videos.length>12&&<p className="subtitle" style={{marginTop:10}}>当前只预览前 12 条，确认后会处理全部 {videos.length} 条。</p>}<button className="btn btn-primary" style={{marginTop:17}} onClick={confirm}>确认导入待整理队列</button></>}{result&&<div className="notice" style={{marginTop:14,background:"var(--leaf-soft)",color:"var(--leaf)"}}>{result}</div>}
    </section><aside><div className="panel"><h2>导入后会发生什么？</h2><ol className="step-list"><li className="step-item"><span className="step-no">1</span><p>按 BV 号去重，重复运行不会重复创建。</p></li><li className="step-item"><span className="step-no">2</span><p>视频进入“待整理”状态，只保存标题、链接、UP主等元数据。</p></li><li className="step-item"><span className="step-no">3</span><p>逐条补充配料、用量和步骤，未知信息保留为空。</p></li><li className="step-item"><span className="step-no">4</span><p>实际做成功后，再标记为“已成功”或“常做”。</p></li></ol><div className="notice">第一版不会下载或重新发布 B 站视频，也不会把浏览器 Cookie 上传到数据库。</div></div></aside></div></div>;
}
