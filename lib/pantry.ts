import { findKitchenEntry } from "./kitchen-dictionary";
import { getSupabase } from "./supabase";

export type PantryItem={
  id:string;
  ingredientKey:string;
  name:string;
  category:string;
  storageLocation:PantryLocation;
  createdAt:string;
  updatedAt:string;
};

export type PantryLocation="fridge"|"cabinet";
export type PantryDraft={ingredientKey:string;name:string;category?:string;storageLocation?:PantryLocation};

function clean(value:string){return value.trim().replace(/\s+/g," ");}

export function pantryDraftFromName(value:string):PantryDraft{
  const name=clean(value);
  if(!name)throw new Error("请先填写食材或调料名称。");
  const entry=findKitchenEntry(name,"ingredient");
  return {
    ingredientKey:entry?.id||name.toLocaleLowerCase("zh-CN"),
    name:entry?.zh||name,
    category:entry?.category||"",
  };
}

function mapPantry(row:Record<string,unknown>):PantryItem{
  return {
    id:String(row.id||""),
    ingredientKey:String(row.ingredient_key||""),
    name:String(row.name||""),
    category:String(row.category||""),
    storageLocation:row.storage_location==="cabinet"?"cabinet":"fridge",
    createdAt:String(row.created_at||""),
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

export async function loadPantryItems():Promise<PantryItem[]>{
  const s=getSupabase();
  if(!s)return [];
  const {data:{user},error:userError}=await s.auth.getUser();
  if(userError)throw userError;
  if(!user)return [];
  const {data,error}=await s.from("pantry_items")
    .select("id,ingredient_key,name,category,storage_location,created_at,updated_at")
    .eq("owner_id",user.id)
    .order("updated_at",{ascending:false});
  if(error)throw error;
  return (data||[]).map(row=>mapPantry(row as Record<string,unknown>));
}

export async function savePantryItem(draft:PantryDraft):Promise<PantryItem>{
  const {s,user}=await requireUser();
  const now=new Date().toISOString();
  const {data,error}=await s.from("pantry_items").upsert({
    owner_id:user.id,
    ingredient_key:draft.ingredientKey,
    name:clean(draft.name),
    category:clean(draft.category||"")||null,
    storage_location:draft.storageLocation||"fridge",
    updated_at:now,
  },{onConflict:"owner_id,ingredient_key"})
    .select("id,ingredient_key,name,category,storage_location,created_at,updated_at")
    .single();
  if(error)throw error;
  return mapPantry(data as Record<string,unknown>);
}

export async function addPantryItemByName(name:string,storageLocation:PantryLocation="fridge"){
  return savePantryItem({...pantryDraftFromName(name),storageLocation});
}

export async function removePantryItem(id:string){
  const {s,user}=await requireUser();
  const {error}=await s.from("pantry_items").delete().eq("id",id).eq("owner_id",user.id);
  if(error)throw error;
}

export async function removePantryItems(ids:string[]){
  if(!ids.length)return;
  const {s,user}=await requireUser();
  const {error}=await s.from("pantry_items").delete().in("id",ids).eq("owner_id",user.id);
  if(error)throw error;
}
