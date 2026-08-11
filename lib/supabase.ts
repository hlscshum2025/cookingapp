import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CookingLog, ImportJobSummary, ImportResult, IngredientMapping, NormalizedFavoriteVideo, Recipe, SourceVideo } from "./types";
import type { ManualEntryPayload, ManualEntryResult } from "./manual-entry";

let client:SupabaseClient|null=null;
let connection:Promise<SupabaseClient|null>|null=null;
let runtimeConfig:RuntimeConfig|null=null;
let runtimeConfigRequest:Promise<RuntimeConfig|null>|null=null;

type RuntimeConfig = {supabaseUrl?:unknown;supabasePublishableKey?:unknown;turnstileSiteKey?:unknown};

function validRuntimeConfig(value:RuntimeConfig):value is {supabaseUrl:string;supabasePublishableKey:string}{
  if(typeof value.supabaseUrl!=="string"||typeof value.supabasePublishableKey!=="string")return false;
  try{return new URL(value.supabaseUrl).protocol==="https:"&&value.supabasePublishableKey.length>=20;}catch{return false;}
}

export async function connectSupabase(){
  if(client)return client;
  if(typeof window==="undefined")return null;
  if(!connection){
    connection=loadRuntimeConfig()
      .then(config=>{
        if(!config||!validRuntimeConfig(config))throw new Error("Supabase runtime configuration is invalid.");
        client=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        return client;
      })
      .catch(()=>null)
      .finally(()=>{connection=null;});
  }
  return connection;
}

async function loadRuntimeConfig(){
  if(runtimeConfig)return runtimeConfig;
  if(!runtimeConfigRequest){
    runtimeConfigRequest=fetch("/api/runtime-config",{headers:{Accept:"application/json"},cache:"default"})
      .then(async response=>{
        if(!response.ok)throw new Error("Supabase runtime configuration is unavailable.");
        runtimeConfig=await response.json() as RuntimeConfig;
        return runtimeConfig;
      })
      .catch(()=>null)
      .finally(()=>{runtimeConfigRequest=null;});
  }
  return runtimeConfigRequest;
}

export async function getTurnstileSiteKey(){
  const config=await loadRuntimeConfig();
  return typeof config?.turnstileSiteKey==="string"&&config.turnstileSiteKey.length>=10
    ?config.turnstileSiteKey
    :null;
}

export function getSupabase(){return client;}

export async function loadCloudData(userId:string){
  const supabase=getSupabase(); if(!supabase)return null;
  const [recipes,logs,ingredients,importJobs,sourceVideos]=await Promise.all([
    supabase.from("recipes").select("document").eq("owner_id",userId).is("deleted_at",null).order("updated_at",{ascending:false}),
    supabase.from("cooking_logs").select("document").eq("owner_id",userId).order("cooked_at",{ascending:false}),
    supabase.from("ingredients").select("document").eq("owner_id",userId).order("updated_at",{ascending:false}),
    supabase.from("import_jobs").select("id,file_name,source_collection_id,status,counters,created_at,finished_at").eq("owner_id",userId).order("created_at",{ascending:false}).limit(20),
    supabase.from("source_videos").select("id,platform,external_id,url,title,uploader_name,cover_url,description,availability,duration_seconds,published_at,favorited_at,updated_at").eq("owner_id",userId).order("updated_at",{ascending:false})
  ]);
  if(recipes.error)throw recipes.error; if(logs.error)throw logs.error; if(ingredients.error)throw ingredients.error; if(importJobs.error)throw importJobs.error; if(sourceVideos.error)throw sourceVideos.error;
  const cloudLogs=await Promise.all((logs.data||[]).map(async row=>{const log=row.document as CookingLog;if(!log.photoPath)return log;const {data}=await supabase.storage.from("recipe-images").createSignedUrl(log.photoPath,3600);return {...log,photoUrl:data?.signedUrl};}));
  const jobs:ImportJobSummary[]=(importJobs.data||[]).map(row=>{const counters=(row.counters||{}) as Record<string,number>;return{id:row.id,fileName:row.file_name||undefined,sourceCollectionId:row.source_collection_id||undefined,status:row.status,total:counters.total||0,added:counters.added||0,duplicates:counters.duplicates||0,failed:counters.failed||0,skipped:counters.skipped||0,createdAt:row.created_at,finishedAt:row.finished_at||undefined};});
  const videos:SourceVideo[]=(sourceVideos.data||[]).map(row=>({
    id:row.id,platform:row.platform,externalId:row.external_id,url:row.url,title:row.title||row.external_id,
    uploaderName:row.uploader_name||"",coverUrl:row.cover_url||"",description:row.description||"",
    availability:row.availability||"available",durationSeconds:row.duration_seconds??undefined,
    publishedAt:row.published_at??undefined,favoritedAt:row.favorited_at??undefined,updatedAt:row.updated_at,
  }));
  return {recipes:(recipes.data||[]).map(r=>r.document as Recipe),logs:cloudLogs,ingredients:(ingredients.data||[]).map(r=>r.document as IngredientMapping),importJobs:jobs,sourceVideos:videos};
}

export async function importBilibiliFavorites(videos:NormalizedFavoriteVideo[],metadata:{collectionId?:string;fileName?:string}):Promise<ImportResult|null>{
  const s=getSupabase();if(!s)return null;const {data:{user}}=await s.auth.getUser();if(!user)return null;
  const payload=videos.map(video=>({bvid:video.bvid,title:video.title,video_url:video.url,uploader:video.uploader,intro:video.description,cover_url:video.coverUrl,duration_seconds:video.durationSeconds,published_at:video.publishedAt,favorited_at:video.favoritedAt,favorite_id:video.favoriteId,invalid:video.invalid,raw:video.raw}));
  const {data,error}=await s.rpc("import_bilibili_favorites",{p_videos:payload,p_collection_id:metadata.collectionId||null,p_file_name:metadata.fileName||null});
  if(error){if(error.message.includes("import_bilibili_favorites"))throw new Error("数据库尚未安装导入审计函数，请先运行 supabase/migrations/202608030001_import_audit.sql");throw error;}
  const summary=data as Record<string,unknown>;
  return {jobId:String(summary.jobId||summary.job_id||""),mode:"cloud",total:Number(summary.total||videos.length),added:Number(summary.added||0),duplicates:Number(summary.duplicates||0),failed:Number(summary.failed||0),skipped:Number(summary.skipped||0),items:[]};
}

export async function persistRecipe(recipe:Recipe){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const {error}=await s.from("recipes").upsert({id:recipe.id,owner_id:user.id,title:recipe.title,summary:recipe.summary,status:recipe.status,visibility:recipe.visibility,total_minutes:recipe.totalMinutes,document:recipe,updated_at:new Date().toISOString()});if(error)throw error;}
export async function persistManualEntry(payload:ManualEntryPayload):Promise<ManualEntryResult|null>{const s=getSupabase();if(!s)return null;const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("请先登录 CookingApp。");const {data,error}=await s.rpc("save_manual_recipe",{p_payload:payload});if(error){if(error.message.includes("save_manual_recipe"))throw new Error("数据库尚未安装手动录入函数，请先运行 supabase/migrations/202608090001_manual_recipe_entry.sql");throw error;}const result=data as Record<string,unknown>;return{recipeId:String(result.recipeId||result.recipe_id||""),sourceVideoId:result.sourceVideoId?String(result.sourceVideoId):undefined,versionId:String(result.versionId||result.version_id||""),versionNo:Number(result.versionNo||result.version_no||0)};}
export async function removeCloudRecipe(id:string){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const {error}=await s.from("recipes").update({deleted_at:new Date().toISOString()}).eq("id",id).eq("owner_id",user.id);if(error)throw error;}
export async function persistLog(log:CookingLog){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const document={...log,photoUrl:undefined};const {error}=await s.from("cooking_logs").upsert({id:log.id,owner_id:user.id,recipe_id:log.recipeId,cooked_at:log.cookedAt,rating:log.rating,document});if(error)throw error;}
export async function persistIngredient(item:IngredientMapping){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const {error}=await s.from("ingredients").upsert({id:item.id,owner_id:user.id,canonical_name_zh:item.zh,name_en:item.en,name_de:item.de,gluten_status:item.gluten,verification_status:item.verified?"user_verified":"unverified",document:item,updated_at:new Date().toISOString()});if(error)throw error;}
export async function getPublicRecipe(id:string){const s=getSupabase();if(!s)return null;const {data,error}=await s.from("recipes").select("document").eq("id",id).eq("visibility","public").is("deleted_at",null).maybeSingle();if(error)throw error;return data?.document as Recipe|undefined;}
export async function uploadLogPhoto(file:File){const s=getSupabase();if(!s)return null;const {data:{user}}=await s.auth.getUser();if(!user)return null;const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`${user.id}/logs/${crypto.randomUUID()}-${safe}`;const {error}=await s.storage.from("recipe-images").upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;const {data}=await s.storage.from("recipe-images").createSignedUrl(path,3600);return {path,url:data?.signedUrl};}

const BACKUP_TABLES = [
  "recipes",
  "recipe_versions",
  "cooking_logs",
  "ingredients",
  "source_videos",
  "import_jobs",
  "import_items",
  "tags",
  "recipe_tags",
] as const;

async function readAllOwnedRows(s:SupabaseClient,table:string,userId:string){
  const rows:unknown[]=[];
  const pageSize=1000;
  for(let from=0;;from+=pageSize){
    const {data,error}=await s.from(table).select("*").eq("owner_id",userId).range(from,from+pageSize-1);
    if(error)throw error;
    rows.push(...(data||[]));
    if((data||[]).length<pageSize)break;
  }
  return rows;
}

/**
 * Export every owner-visible database row. Storage objects are deliberately not
 * embedded: photos are binary files and need a separate Storage backup.
 */
export async function exportCloudBackup(){
  const s=getSupabase();if(!s)return null;
  const {data:{user}}=await s.auth.getUser();if(!user)return null;
  const {data:profiles,error:profileError}=await s.from("profiles").select("*").eq("id",user.id);
  if(profileError)throw profileError;
  const entries=await Promise.all(BACKUP_TABLES.map(async table=>[table,await readAllOwnedRows(s,table,user.id)] as const));
  return {
    schemaVersion:"cookingapp-backup-2",
    exportedAt:new Date().toISOString(),
    tables:{profiles:profiles||[],...Object.fromEntries(entries)},
    storage:{included:false,bucket:"recipe-images",note:"图片文件需从 Supabase Storage 单独备份；本 JSON 只保存数据库记录与图片路径。"},
  };
}
