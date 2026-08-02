import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CookingLog, IngredientMapping, Recipe } from "./types";

let client:SupabaseClient|null=null;
export function getSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null; if(!client)client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); return client;
}

export async function loadCloudData(userId:string){
  const supabase=getSupabase(); if(!supabase)return null;
  const [recipes,logs,ingredients]=await Promise.all([
    supabase.from("recipes").select("document").eq("owner_id",userId).is("deleted_at",null).order("updated_at",{ascending:false}),
    supabase.from("cooking_logs").select("document").eq("owner_id",userId).order("cooked_at",{ascending:false}),
    supabase.from("ingredients").select("document").eq("owner_id",userId).order("updated_at",{ascending:false})
  ]);
  if(recipes.error)throw recipes.error; if(logs.error)throw logs.error; if(ingredients.error)throw ingredients.error;
  const cloudLogs=await Promise.all((logs.data||[]).map(async row=>{const log=row.document as CookingLog;if(!log.photoPath)return log;const {data}=await supabase.storage.from("recipe-images").createSignedUrl(log.photoPath,3600);return {...log,photoUrl:data?.signedUrl};}));
  return {recipes:(recipes.data||[]).map(r=>r.document as Recipe),logs:cloudLogs,ingredients:(ingredients.data||[]).map(r=>r.document as IngredientMapping)};
}

export async function persistRecipe(recipe:Recipe){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const {error}=await s.from("recipes").upsert({id:recipe.id,owner_id:user.id,title:recipe.title,summary:recipe.summary,status:recipe.status,visibility:recipe.visibility,total_minutes:recipe.totalMinutes,document:recipe,updated_at:new Date().toISOString()});if(error)throw error;}
export async function removeCloudRecipe(id:string){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const {error}=await s.from("recipes").update({deleted_at:new Date().toISOString()}).eq("id",id).eq("owner_id",user.id);if(error)throw error;}
export async function persistLog(log:CookingLog){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const document={...log,photoUrl:undefined};const {error}=await s.from("cooking_logs").upsert({id:log.id,owner_id:user.id,recipe_id:log.recipeId,cooked_at:log.cookedAt,rating:log.rating,document});if(error)throw error;}
export async function persistIngredient(item:IngredientMapping){const s=getSupabase();if(!s)return;const {data:{user}}=await s.auth.getUser();if(!user)return;const {error}=await s.from("ingredients").upsert({id:item.id,owner_id:user.id,canonical_name_zh:item.zh,name_en:item.en,name_de:item.de,gluten_status:item.gluten,verification_status:item.verified?"user_verified":"unverified",document:item,updated_at:new Date().toISOString()});if(error)throw error;}
export async function getPublicRecipe(id:string){const s=getSupabase();if(!s)return null;const {data,error}=await s.from("recipes").select("document").eq("id",id).eq("visibility","public").is("deleted_at",null).maybeSingle();if(error)throw error;return data?.document as Recipe|undefined;}
export async function uploadLogPhoto(file:File){const s=getSupabase();if(!s)return null;const {data:{user}}=await s.auth.getUser();if(!user)return null;const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`${user.id}/logs/${crypto.randomUUID()}-${safe}`;const {error}=await s.storage.from("recipe-images").upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;const {data}=await s.storage.from("recipe-images").createSignedUrl(path,3600);return {path,url:data?.signedUrl};}
