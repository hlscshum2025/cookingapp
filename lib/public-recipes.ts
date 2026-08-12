import type { PublicRecipe, PublicationRequest, Recipe } from "./types";
import { getSupabase } from "./supabase";

function normalizePublicRecipe(row:Record<string,unknown>):PublicRecipe{
  const recipe={...(row.snapshot as Recipe),visibility:"public" as const};
  return {
    recipeId:String(row.recipe_id||recipe.id||""),
    publicationRequestId:String(row.publication_request_id||""),
    publishedAt:String(row.published_at||""),
    recipe,
  };
}

function normalizeRequest(row:Record<string,unknown>):PublicationRequest{
  return {
    id:String(row.id||""),
    recipeId:String(row.recipe_id||""),
    ownerId:String(row.owner_id||""),
    title:String(row.title||""),
    summary:String(row.summary||""),
    status:(row.status as PublicationRequest["status"])||"pending",
    submittedAt:String(row.submitted_at||""),
    reviewedAt:row.reviewed_at?String(row.reviewed_at):undefined,
    reviewNote:row.review_note?String(row.review_note):undefined,
    recipe:{...(row.snapshot as Recipe),visibility:"public"},
  };
}

export async function loadPublicRecipes():Promise<PublicRecipe[]>{
  const s=getSupabase();
  if(!s)return [];
  const {data,error}=await s
    .from("public_recipes")
    .select("recipe_id,publication_request_id,title,summary,snapshot,published_at")
    .order("published_at",{ascending:false});
  if(error)throw error;
  return (data||[]).map(row=>normalizePublicRecipe(row as Record<string,unknown>));
}

export async function loadPublicRecipe(recipeId:string):Promise<PublicRecipe|null>{
  const s=getSupabase();
  if(!s)return null;
  const {data,error}=await s
    .from("public_recipes")
    .select("recipe_id,publication_request_id,title,summary,snapshot,published_at")
    .eq("recipe_id",recipeId)
    .maybeSingle();
  if(error)throw error;
  return data?normalizePublicRecipe(data as Record<string,unknown>):null;
}

export async function isRecipePublished(recipeId:string){
  return Boolean(await loadPublicRecipe(recipeId));
}

export async function loadMyPublicationRequests(recipeId:string):Promise<PublicationRequest[]>{
  const s=getSupabase();
  if(!s)return [];
  const {data,error}=await s
    .from("recipe_publication_requests")
    .select("id,recipe_id,owner_id,title,summary,status,snapshot,submitted_at,reviewed_at,review_note")
    .eq("recipe_id",recipeId)
    .order("submitted_at",{ascending:false});
  if(error)throw error;
  return (data||[]).map(row=>normalizeRequest(row as Record<string,unknown>));
}

export async function submitRecipePublication(recipeId:string){
  const s=getSupabase();
  if(!s)throw new Error("Supabase 尚未连接。");
  const {data,error}=await s.rpc("submit_recipe_publication",{p_recipe_id:recipeId});
  if(error){
    if(/publication_already_pending/i.test(error.message))throw new Error("这道菜已经有一份待审核申请，请先等待管理员处理。");
    throw error;
  }
  return String(data||"");
}

export async function loadPendingPublicationRequests():Promise<PublicationRequest[]>{
  const s=getSupabase();
  if(!s)return [];
  const {data,error}=await s
    .from("recipe_publication_requests")
    .select("id,recipe_id,owner_id,title,summary,status,snapshot,submitted_at,reviewed_at,review_note")
    .eq("status","pending")
    .order("submitted_at",{ascending:true});
  if(error)throw error;
  return (data||[]).map(row=>normalizeRequest(row as Record<string,unknown>));
}

export async function reviewPublicationRequest(requestId:string,decision:"approved"|"rejected",note=""){
  const s=getSupabase();
  if(!s)throw new Error("Supabase 尚未连接。");
  const {data,error}=await s.rpc("review_recipe_publication",{
    p_request_id:requestId,
    p_decision:decision,
    p_note:note||null,
  });
  if(error){
    if(/admin_required/i.test(error.message))throw new Error("只有管理员可以审核公开申请。");
    throw error;
  }
  return data;
}
