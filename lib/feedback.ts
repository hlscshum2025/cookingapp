import { getSupabase } from "./supabase";

export type FeedbackCategory="platform_request"|"bug"|"feature"|"content_change";
export type FeedbackStatus="new"|"triaged"|"planned"|"resolved"|"declined";
export type FeedbackPriority="p0"|"p1"|"p2"|"p3";
export type FeedbackSubmission={
  id:string;
  ownerId:string;
  category:FeedbackCategory;
  title:string;
  details:string;
  context:Record<string,unknown>;
  status:FeedbackStatus;
  priority:FeedbackPriority;
  adminNote:string;
  createdAt:string;
};

function mapFeedback(row:Record<string,unknown>):FeedbackSubmission{
  return {
    id:String(row.id),ownerId:String(row.owner_id),category:row.category as FeedbackCategory,
    title:String(row.title||""),details:String(row.details||""),context:(row.context||{}) as Record<string,unknown>,
    status:row.status as FeedbackStatus,priority:row.priority as FeedbackPriority,adminNote:String(row.admin_note||""),createdAt:String(row.created_at),
  };
}

export async function submitFeedback(input:{category:FeedbackCategory;title:string;details:string;context?:Record<string,unknown>}){
  const s=getSupabase();if(!s)throw new Error("Supabase 尚未连接。");
  const {data:{user},error:userError}=await s.auth.getUser();
  if(userError||!user)throw new Error("请先登录再提交建议。");
  const {data,error}=await s.from("feedback_submissions").insert({
    owner_id:user.id,category:input.category,title:input.title.trim(),details:input.details.trim(),context:input.context||{},
  }).select("*").single();
  if(error)throw error;
  return mapFeedback(data as Record<string,unknown>);
}

export async function loadMyFeedback(){
  const s=getSupabase();if(!s)return [];
  const {data:{user}}=await s.auth.getUser();if(!user)return [];
  const {data,error}=await s.from("feedback_submissions").select("*").eq("owner_id",user.id).order("created_at",{ascending:false}).limit(20);
  if(error)throw error;
  return (data||[]).map(row=>mapFeedback(row as Record<string,unknown>));
}

export async function loadFeedbackQueue(){
  const s=getSupabase();if(!s)return [];
  const {data,error}=await s.from("feedback_submissions").select("*").order("created_at",{ascending:false}).limit(100);
  if(error)throw error;
  return (data||[]).map(row=>mapFeedback(row as Record<string,unknown>));
}

export async function reviewFeedback(id:string,input:{status:FeedbackStatus;priority:FeedbackPriority;adminNote:string}){
  const s=getSupabase();if(!s)throw new Error("Supabase 尚未连接。");
  const {data:{user}}=await s.auth.getUser();if(!user)throw new Error("请先登录。");
  const {error}=await s.from("feedback_submissions").update({status:input.status,priority:input.priority,admin_note:input.adminNote.trim()||null,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
  if(error)throw error;
}
