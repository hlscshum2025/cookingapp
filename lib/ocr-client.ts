import {getSupabase} from "@/lib/supabase";
import {isOcrJobV1,type OcrJobV1} from "@/lib/vision-contracts";

let runtimeWorkerUrl:Promise<string>|null=null;

async function workerUrl(){
  const builtIn=String(process.env.NEXT_PUBLIC_VISION_API_URL||"").replace(/\/$/,"");
  if(builtIn)return builtIn;
  runtimeWorkerUrl??=fetch("/api/runtime-config",{headers:{Accept:"application/json"},cache:"default"})
    .then(async response=>{
      const body:unknown=await response.json().catch(()=>null);
      const value=body&&typeof body==="object"&&"visionApiUrl" in body?String(body.visionApiUrl||"").replace(/\/$/,""):"";
      if(!value)throw new Error("OCR worker 尚未配置。");
      const parsed=new URL(value);
      if(parsed.protocol!=="https:"&&!(["localhost","127.0.0.1"].includes(parsed.hostname)&&parsed.protocol==="http:"))throw new Error("OCR worker 地址必须使用 HTTPS。");
      return value;
    })
    .catch(error=>{runtimeWorkerUrl=null;throw error;});
  return runtimeWorkerUrl;
}

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
  const base=await workerUrl();
  const form=new FormData();
  files.forEach(file=>form.append("files",file,file.name));
  return readJob(await fetch(`${base}/v1/ocr/jobs?kind=${kind}`,{
    method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`},body:form,
  }));
}

export async function getOcrJob(jobId:string){
  const base=await workerUrl();
  return readJob(await fetch(`${base}/v1/ocr/jobs/${encodeURIComponent(jobId)}`,{
    headers:{Authorization:`Bearer ${await accessToken()}`},cache:"no-store",
  }));
}
