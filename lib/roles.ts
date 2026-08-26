import { getSessionUser, getSupabase } from "./supabase";
import type { AppRole } from "./permissions";

export async function getCurrentAppRole():Promise<AppRole>{
  const s=getSupabase();
  if(!s)return "user";
  const user=await getSessionUser(s);
  if(!user)return "user";
  const {data,error}=await s.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(error)return "user";
  return data?.role==="admin"?"admin":"user";
}
