import {connectSupabase,getSessionUser,getSupabase} from "@/lib/supabase";
import {isOcrJobV1,type OcrJobV1} from "@/lib/vision-contracts";

type OcrKind="receipt"|"xiaohongshu";
type OcrTransport="queue"|"direct";
type RuntimeOcrConfig={transport:OcrTransport;workerUrl:string};

const MAX_FILES=12;
const MAX_FILE_BYTES=15*1024*1024;
const ALLOWED_TYPES=new Set(["image/jpeg","image/png","image/webp"]);
let runtimeConfig:Promise<RuntimeOcrConfig>|null=null;
const jobTransports=new Map<string,OcrTransport>();

async function loadRuntimeOcrConfig():Promise<RuntimeOcrConfig>{
  runtimeConfig??=fetch("/api/runtime-config",{headers:{Accept:"application/json"},cache:"default"})
    .then(async response=>{
      const body:unknown=await response.json().catch(()=>null);
      if(!response.ok||!body||typeof body!=="object")throw new Error("OCR运行配置不可用。");
      const record=body as Record<string,unknown>;
      const transport:OcrTransport=record.ocrTransport==="direct"?"direct":"queue";
      const workerUrl=String(record.visionApiUrl||"").replace(/\/$/,"");
      if(transport==="direct"){
        if(!workerUrl)throw new Error("OCR worker 尚未配置。");
        const parsed=new URL(workerUrl);
        if(parsed.protocol!=="https:"&&!(parsed.protocol==="http:"&&["localhost","127.0.0.1"].includes(parsed.hostname))){
          throw new Error("OCR worker 地址必须使用 HTTPS。");
        }
      }
      return {transport,workerUrl};
    })
    .catch(error=>{runtimeConfig=null;throw error;});
  return runtimeConfig;
}

async function authenticatedSupabase(){
  const client=getSupabase()||await connectSupabase();
  if(!client)throw new Error("Supabase 尚未配置。");
  const user=await getSessionUser(client);
  if(!user)throw new Error("登录已失效，请重新登录。");
  return {client,user};
}

function validateFiles(files:File[]){
  if(files.length<1||files.length>MAX_FILES)throw new Error("请选择1–12张图片。");
  for(const file of files){
    if(!ALLOWED_TYPES.has(file.type))throw new Error(`不支持 ${file.name} 的文件格式。`);
    if(file.size<1||file.size>MAX_FILE_BYTES)throw new Error(`${file.name} 必须小于15MB。`);
  }
}

function safeFileName(name:string){
  const cleaned=name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g,"-").replace(/-+/g,"-");
  return cleaned.slice(-120)||"image";
}

function parseJob(value:unknown):OcrJobV1{
  if(!isOcrJobV1(value))throw new Error("OCR任务返回了无法识别的数据结构。");
  return value;
}

function queuedRowToJob(value:Record<string,unknown>):OcrJobV1{
  return parseJob({...value,error:value.error_message??null});
}

async function createQueuedJob(kind:OcrKind,files:File[]):Promise<OcrJobV1>{
  validateFiles(files);
  const {client,user}=await authenticatedSupabase();
  const jobId=crypto.randomUUID();
  const uploadedPaths:string[]=[];
  const {error:createError}=await client.from("ocr_jobs").insert({
    id:jobId,owner_id:user.id,kind,status:"uploading",file_count:0,
  });
  if(createError)throw new Error(`无法创建OCR任务：${createError.message}`);
  try{
    const rows=[];
    for(let index=0;index<files.length;index+=1){
      const file=files[index];
      const path=`${user.id}/${jobId}/${String(index+1).padStart(2,"0")}-${safeFileName(file.name)}`;
      const {error}=await client.storage.from("ocr-inputs").upload(path,file,{contentType:file.type,upsert:false,cacheControl:"3600"});
      if(error)throw error;
      uploadedPaths.push(path);
      rows.push({
        owner_id:user.id,job_id:jobId,input_index:index+1,bucket_id:"ocr-inputs",
        storage_path:path,original_name:file.name.slice(0,255),media_type:file.type,byte_size:file.size,
      });
    }
    const {error:fileError}=await client.from("ocr_job_files").insert(rows);
    if(fileError)throw fileError;
    const {data:queued,error:queueError}=await client.from("ocr_jobs")
      .update({status:"queued",file_count:files.length})
      .eq("id",jobId)
      .eq("owner_id",user.id)
      .eq("status","uploading")
      .select("id,kind,status,created_at,updated_at,result,error_message")
      .single();
    if(queueError)throw queueError;
    jobTransports.set(jobId,"queue");
    return queuedRowToJob(queued);
  }catch(reason){
    if(uploadedPaths.length)await client.storage.from("ocr-inputs").remove(uploadedPaths).catch(()=>undefined);
    await client.from("ocr_jobs").delete().eq("id",jobId).eq("owner_id",user.id);
    throw new Error(`图片上传失败：${reason instanceof Error?reason.message:"未知错误"}`);
  }
}

async function getQueuedJob(jobId:string):Promise<OcrJobV1>{
  const {client,user}=await authenticatedSupabase();
  const {data,error}=await client.from("ocr_jobs")
    .select("id,kind,status,created_at,updated_at,result,error_message")
    .eq("id",jobId)
    .eq("owner_id",user.id)
    .single();
  if(error)throw new Error(`OCR任务读取失败：${error.message}`);
  return queuedRowToJob(data);
}

export async function listRecentOcrJobs(kind:OcrKind,limit=8):Promise<OcrJobV1[]>{
  const config=await loadRuntimeOcrConfig();
  if(config.transport==="direct")return [];
  const {client,user}=await authenticatedSupabase();
  const {data,error}=await client.from("ocr_jobs")
    .select("id,kind,status,created_at,updated_at,result,error_message")
    .eq("owner_id",user.id)
    .eq("kind",kind)
    .order("created_at",{ascending:false})
    .limit(Math.max(1,Math.min(limit,20)));
  if(error)throw new Error(`OCR任务列表读取失败：${error.message}`);
  return (data||[]).map(queuedRowToJob);
}

async function accessToken(){
  const {client}=await authenticatedSupabase();
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session)throw new Error("登录已失效，请重新登录。");
  return session.access_token;
}

async function readDirectJob(response:Response):Promise<OcrJobV1>{
  const body:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`OCR服务请求失败（${response.status}）`);
  return parseJob(body);
}

async function createDirectJob(kind:OcrKind,files:File[],workerUrl:string){
  validateFiles(files);
  const form=new FormData();
  files.forEach(file=>form.append("files",file,file.name));
  const job=await readDirectJob(await fetch(`${workerUrl}/v1/ocr/jobs?kind=${kind}`,{
    method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`},body:form,
  }));
  jobTransports.set(job.id,"direct");
  return job;
}

async function getDirectJob(jobId:string,workerUrl:string){
  return readDirectJob(await fetch(`${workerUrl}/v1/ocr/jobs/${encodeURIComponent(jobId)}`,{
    headers:{Authorization:`Bearer ${await accessToken()}`},cache:"no-store",
  }));
}

export async function createOcrJob(kind:OcrKind,files:File[]){
  const config=await loadRuntimeOcrConfig();
  return config.transport==="direct"
    ?createDirectJob(kind,files,config.workerUrl)
    :createQueuedJob(kind,files);
}

export async function getOcrJob(jobId:string){
  const config=await loadRuntimeOcrConfig();
  const transport=jobTransports.get(jobId)||config.transport;
  return transport==="direct"
    ?getDirectJob(jobId,config.workerUrl)
    :getQueuedJob(jobId);
}
