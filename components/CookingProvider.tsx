"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoIngredients, demoLogs, demoRecipes } from "@/lib/demo-data";
import { recipeFromFavoriteVideo } from "@/lib/bilibili";
import type { CookingLog, ImportJobSummary, ImportResult, IngredientMapping, NormalizedFavoriteVideo, Recipe } from "@/lib/types";
import { getSupabase, importBilibiliFavorites, loadCloudData, persistIngredient, persistLog, persistRecipe, removeCloudRecipe } from "@/lib/supabase";

type ContextValue = {
  recipes: Recipe[]; logs: CookingLog[]; ingredients: IngredientMapping[]; importJobs: ImportJobSummary[];
  ready: boolean; isDemo: boolean; cloudStatus: "loading"|"unconfigured"|"signed_out"|"connected"|"error"; cloudError: string;
  saveRecipe:(recipe:Recipe)=>void; deleteRecipe:(id:string)=>void; addLog:(log:CookingLog)=>void; saveIngredient:(item:IngredientMapping)=>void;
  importVideos:(videos:NormalizedFavoriteVideo[],metadata:{collectionId?:string;fileName?:string;skipped?:number})=>Promise<ImportResult>; resetDemo:()=>void;
};
const CookingContext=createContext<ContextValue|null>(null);
const DEMO_KEYS={recipes:"cookingapp.demo.recipes.v1",logs:"cookingapp.demo.logs.v1",ingredients:"cookingapp.demo.ingredients.v1"};
const userKeys=(uid:string)=>({recipes:`cookingapp.user.${uid}.recipes.v1`,logs:`cookingapp.user.${uid}.logs.v1`,ingredients:`cookingapp.user.${uid}.ingredients.v1`});
function load<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback;}catch{return fallback;}}

export function CookingProvider({children}:{children:React.ReactNode}){
  const [recipes,setRecipes]=useState<Recipe[]>(demoRecipes); const [logs,setLogs]=useState<CookingLog[]>(demoLogs); const [ingredients,setIngredients]=useState<IngredientMapping[]>(demoIngredients); const [importJobs,setImportJobs]=useState<ImportJobSummary[]>([]);
  const [ready,setReady]=useState(false); const [isDemo,setIsDemo]=useState(true); const [cloudStatus,setCloudStatus]=useState<ContextValue["cloudStatus"]>("loading"); const [cloudError,setCloudError]=useState(""); const [userId,setUserId]=useState<string|null>(null);

  const hydrate=useCallback(async(uid:string)=>{setReady(false);setUserId(uid);setIsDemo(false);setCloudStatus("loading");const keys=userKeys(uid);setRecipes(load(keys.recipes,[]));setLogs(load(keys.logs,[]));setIngredients(load(keys.ingredients,[]));setImportJobs([]);try{const cloud=await loadCloudData(uid);if(cloud){setRecipes(cloud.recipes);setLogs(cloud.logs);setIngredients(cloud.ingredients);setImportJobs(cloud.importJobs);}setCloudStatus("connected");}catch(e){setCloudError(e instanceof Error?e.message:"云端数据读取失败");setCloudStatus("error");}finally{setReady(true);}},[]);
  const showSignedOut=useCallback(()=>{setUserId(null);setRecipes(load(DEMO_KEYS.recipes,demoRecipes));setLogs(load(DEMO_KEYS.logs,demoLogs));setIngredients(load(DEMO_KEYS.ingredients,demoIngredients));setImportJobs([]);setIsDemo(true);setCloudStatus("signed_out");setReady(true);},[]);

  useEffect(()=>{const s=getSupabase();if(!s){setCloudStatus("unconfigured");setReady(true);return;}s.auth.getSession().then(({data})=>data.session?hydrate(data.session.user.id):showSignedOut());const {data:{subscription}}=s.auth.onAuthStateChange((_event,session)=>{if(session)hydrate(session.user.id);else showSignedOut();});return()=>subscription.unsubscribe();},[hydrate,showSignedOut]);
  useEffect(()=>{if(!ready)return;const keys=userId?userKeys(userId):DEMO_KEYS;localStorage.setItem(keys.recipes,JSON.stringify(recipes));localStorage.setItem(keys.logs,JSON.stringify(logs));localStorage.setItem(keys.ingredients,JSON.stringify(ingredients));},[recipes,logs,ingredients,ready,userId]);

  const saveRecipe=useCallback((recipe:Recipe)=>{setRecipes(old=>old.some(item=>item.id===recipe.id)?old.map(item=>item.id===recipe.id?recipe:item):[recipe,...old]);persistRecipe(recipe).catch(e=>setCloudError(e.message));},[]);
  const deleteRecipe=useCallback((id:string)=>{setRecipes(old=>old.filter(r=>r.id!==id));setLogs(old=>old.filter(l=>l.recipeId!==id));removeCloudRecipe(id).catch(e=>setCloudError(e.message));},[]);
  const addLog=useCallback((log:CookingLog)=>{setLogs(old=>[log,...old]);persistLog(log).catch(e=>setCloudError(e.message));},[]);
  const saveIngredient=useCallback((item:IngredientMapping)=>{setIngredients(old=>old.some(i=>i.id===item.id)?old.map(i=>i.id===item.id?item:i):[item,...old]);persistIngredient(item).catch(e=>setCloudError(e.message));},[]);
  const importVideos=useCallback(async(videos:NormalizedFavoriteVideo[],metadata:{collectionId?:string;fileName?:string;skipped?:number})=>{try{const cloudResult=await importBilibiliFavorites(videos,metadata);if(cloudResult){const s=getSupabase();const {data:{user}}=await s!.auth.getUser();if(user){const cloud=await loadCloudData(user.id);if(cloud){setRecipes(cloud.recipes);setImportJobs(cloud.importJobs);setIsDemo(false);setCloudStatus("connected");}}return{...cloudResult,total:cloudResult.total+(metadata.skipped||0),skipped:cloudResult.skipped+(metadata.skipped||0)};}}catch(e){setCloudError(e instanceof Error?e.message:"云端导入失败");setCloudStatus("error");throw e;}const existing=new Set(recipes.map(r=>r.source?.bvid).filter(Boolean));const items:ImportResult["items"]=[];const additions:Recipe[]=[];videos.forEach(video=>{if(existing.has(video.bvid)){items.push({externalId:video.bvid,title:video.title,status:"duplicate"});return;}existing.add(video.bvid);additions.push(recipeFromFavoriteVideo(video));items.push({externalId:video.bvid,title:video.title,status:"processed"});});setRecipes(old=>[...additions.reverse(),...old]);const jobId=crypto.randomUUID(),now=new Date().toISOString(),result:ImportResult={jobId,mode:"local",total:videos.length+(metadata.skipped||0),added:additions.length,duplicates:items.filter(i=>i.status==="duplicate").length,failed:0,skipped:metadata.skipped||0,items};setImportJobs(old=>[{id:jobId,fileName:metadata.fileName,sourceCollectionId:metadata.collectionId,status:"completed",total:result.total,added:result.added,duplicates:result.duplicates,failed:0,skipped:result.skipped,createdAt:now,finishedAt:now},...old]);return result;},[recipes]);
  const resetDemo=useCallback(()=>{if(userId){setRecipes([]);setLogs([]);setIngredients([]);}else{setRecipes(demoRecipes);setLogs(demoLogs);setIngredients(demoIngredients);}},[userId]);
  const value=useMemo(()=>({recipes,logs,ingredients,importJobs,ready,isDemo,cloudStatus,cloudError,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,resetDemo}),[recipes,logs,ingredients,importJobs,ready,isDemo,cloudStatus,cloudError,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,resetDemo]);
  return <CookingContext.Provider value={value}>{children}</CookingContext.Provider>;
}
export function useCooking(){const value=useContext(CookingContext);if(!value)throw new Error("useCooking must be used within CookingProvider");return value;}
