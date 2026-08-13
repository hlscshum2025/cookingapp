import type { PublicRecipe, PublicationRequest, Recipe } from "./types";
import { getSupabase } from "./supabase";

function normalizePublicRecipe(row:Record<string,unknown>,likedByMe=false):PublicRecipe{
  const recipe={...(row.snapshot as Recipe),visibility:"public" as const};
  return {
    recipeId:String(row.recipe_id||recipe.id||""),
    publicationRequestId:String(row.publication_request_id||""),
    publishedAt:String(row.published_at||""),
    likeCount:Number(row.like_count||0),
    likedByMe,
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

async function loadMyLikedRecipeIds(){
  const s=getSupabase();
  if(!s)return new Set<string>();
  const {data:{user}}=await s.auth.getUser();
  if(!user)return new Set<string>();
  const {data,error}=await s.from("public_recipe_likes").select("recipe_id").eq("user_id",user.id);
  if(error){
    // Older databases may not have the likes migration yet. Keep public reading usable.
    if(/public_recipe_likes/i.test(error.message))return new Set<string>();
    throw error;
  }
  return new Set((data||[]).map(row=>String(row.recipe_id)));
}

export async function loadPublicRecipes():Promise<PublicRecipe[]>{
  const s=getSupabase();
  if(!s)return [];
  const [recipes,liked]=await Promise.all([
    s.from("public_recipes").select("recipe_id,publication_request_id,title,summary,snapshot,published_at,like_count").order("like_count",{ascending:false}).order("published_at",{ascending:false}),
    loadMyLikedRecipeIds(),
  ]);
  if(recipes.error){
    // Compatibility while the likes migration has not been applied yet.
    if(/like_count/i.test(recipes.error.message)){
      const {data,error}=await s.from("public_recipes").select("recipe_id,publication_request_id,title,summary,snapshot,published_at").order("published_at",{ascending:false});
      if(error)throw error;
      return (data||[]).map(row=>normalizePublicRecipe(row as Record<string,unknown>,liked.has(String(row.recipe_id))));
    }
    throw recipes.error;
  }
  return (recipes.data||[]).map(row=>normalizePublicRecipe(row as Record<string,unknown>,liked.has(String(row.recipe_id))));
}

export async function loadPublicRecipe(recipeId:string):Promise<PublicRecipe|null>{
  const s=getSupabase();
  if(!s)return null;
  const liked=await loadMyLikedRecipeIds();
  let {data,error}=await s
    .from("public_recipes")
    .select("recipe_id,publication_request_id,title,summary,snapshot,published_at,like_count")
    .eq("recipe_id",recipeId)
    .maybeSingle();
  if(error&&/like_count/i.test(error.message)){
    const fallback=await s.from("public_recipes").select("recipe_id,publication_request_id,title,summary,snapshot,published_at").eq("recipe_id",recipeId).maybeSingle();
    data=fallback.data as typeof data;
    error=fallback.error;
  }
  if(error)throw error;
  return data?normalizePublicRecipe(data as Record<string,unknown>,liked.has(recipeId)):null;
}

export async function togglePublicRecipeLike(recipeId:string,currentlyLiked:boolean){
  const s=getSupabase();
  if(!s)throw new Error("Supabase 尚未连接。");
  const {data:{user},error:userError}=await s.auth.getUser();
  if(userError)throw userError;
  if(!user)throw new Error("请先登录后再点赞。");
  if(currentlyLiked){
    const {error}=await s.from("public_recipe_likes").delete().eq("recipe_id",recipeId).eq("user_id",user.id);
    if(error)throw error;
    return false;
  }
  const {error}=await s.from("public_recipe_likes").insert({recipe_id:recipeId,user_id:user.id});
  if(error){
    if(error.code==="23505")return true;
    if(/public_recipe_likes/i.test(error.message))throw new Error("数据库尚未安装公开菜谱点赞功能，请先应用最新 Supabase migration。");
    throw error;
  }
  return true;
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
