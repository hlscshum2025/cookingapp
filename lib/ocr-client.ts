import {getSupabase} from "@/lib/supabase";
import {isOcrJobV1,type OcrJobV1} from "@/lib/vision-contracts";

const workerUrl=()=>String(process.env.NEXT_PUBLIC_VISION_API_URL||"").replace(/\/$/,"");

async function accessToken(){
  const client=getSupabase();
  if(!client)throw new Error("Supabase 尚未配置。");
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session)throw new Error("登录已失效，请重新登录。");
  return session.access_token;
}

async function readJob(response:Response):Promise<OcrJobV1>{
  const body:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`OCR 服务请求失败（${response.status}）`);
  if(!isOcrJobV1(body))throw new Error("OCR 服务返回了无法识别的数据结构。");
  return body;
}

export async function createOcrJob(kind:"receipt"|"xiaohongshu",files:File[]){
  const base=workerUrl();
  if(!base)throw new Error("NEXT_PUBLIC_VISION_API_URL 尚未配置。");
  const form=new FormData();
  files.forEach(file=>form.append("files",file,file.name));
  return readJob(await fetch(`${base}/v1/ocr/jobs?kind=${kind}`,{
    method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`},body:form,
  }));
}

export async function getOcrJob(jobId:string){
  const base=workerUrl();
  if(!base)throw new Error("NEXT_PUBLIC_VISION_API_URL 尚未配置。");
  return readJob(await fetch(`${base}/v1/ocr/jobs/${encodeURIComponent(jobId)}`,{
    headers:{Authorization:`Bearer ${await accessToken()}`},cache:"no-store",
  }));
}
