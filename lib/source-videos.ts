import type { SourceVideo } from "./types";
import type { ImportedSourceDraft } from "./source-adapters";
import { getSupabase } from "./supabase";

function mapSource(row:Record<string,unknown>):SourceVideo{
  return {
    id:String(row.id||""),
    platform:String(row.platform||""),
    externalId:String(row.external_id||""),
    url:String(row.url||""),
    title:String(row.title||row.external_id||"待整理视频"),
    uploaderName:String(row.uploader_name||""),
    coverUrl:String(row.cover_url||""),
    description:String(row.description||""),
    availability:String(row.availability||"available"),
    durationSeconds:row.duration_seconds===null||row.duration_seconds===undefined?undefined:Number(row.duration_seconds),
    publishedAt:row.published_at?String(row.published_at):undefined,
    favoritedAt:row.favorited_at?String(row.favorited_at):undefined,
    updatedAt:String(row.updated_at||""),
  };
}

async function requireUser(){
  const s=getSupabase();
  if(!s)throw new Error("Supabase 尚未连接。");
  const {data:{user},error}=await s.auth.getUser();
  if(error)throw error;
  if(!user)throw new Error("请先登录 CookingApp。");
  return {s,user};
}

export async function loadPendingSourceVideos():Promise<SourceVideo[]>{
  const s=getSupabase();
  if(!s)return [];
  const {data:{user},error:userError}=await s.auth.getUser();
  if(userError)throw userError;
  if(!user)return [];
  const {data,error}=await s
    .from("source_videos")
    .select("id,platform,external_id,url,title,uploader_name,cover_url,description,availability,duration_seconds,published_at,favorited_at,updated_at")
    .eq("owner_id",user.id)
    .eq("workflow_status","pending")
    .order("updated_at",{ascending:false});
  if(error)throw error;
  return (data||[]).map(row=>mapSource(row as Record<string,unknown>));
}

export async function saveSharedRecipeSource(source:ImportedSourceDraft):Promise<SourceVideo>{
  const {s,user}=await requireUser();
  const now=new Date().toISOString();
  const {data,error}=await s
    .from("source_videos")
    .upsert({
      owner_id:user.id,
      platform:source.platform,
      external_id:source.externalId,
      url:source.url,
      title:source.title,
      uploader_name:source.uploaderName||null,
      description:source.description||null,
      availability:"available",
      workflow_status:"pending",
      raw_metadata:{importMode:"shared_text",rawText:source.rawText,platformLabel:source.platformLabel},
      updated_at:now,
    },{onConflict:"owner_id,platform,external_id"})
    .select("id,platform,external_id,url,title,uploader_name,cover_url,description,availability,duration_seconds,published_at,favorited_at,updated_at")
    .single();
  if(error)throw error;
  return mapSource(data as Record<string,unknown>);
}

export async function markSourceVideoCompleted(sourceVideoId:string){
  const {s,user}=await requireUser();
  const {error}=await s
    .from("source_videos")
    .update({workflow_status:"completed",updated_at:new Date().toISOString()})
    .eq("id",sourceVideoId)
    .eq("owner_id",user.id);
  if(error)throw error;
}

export async function discardPendingSourceVideo(sourceVideoId:string){
  const {s,user}=await requireUser();
  const {error}=await s
    .from("source_videos")
    .delete()
    .eq("id",sourceVideoId)
    .eq("owner_id",user.id)
    .eq("workflow_status","pending");
  if(error)throw error;
}
