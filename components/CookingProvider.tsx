"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoIngredients, demoLogs, demoRecipes } from "@/lib/demo-data";
import { recipeFromFavoriteVideo } from "@/lib/bilibili";
import type { CookingLog, ImportJobSummary, ImportResult, IngredientMapping, NormalizedFavoriteVideo, Recipe, SourceVideo } from "@/lib/types";
import { connectSupabase, getSupabase, importBilibiliFavorites, loadCloudData, persistIngredient, persistLog, persistRecipe, removeCloudRecipe } from "@/lib/supabase";

type ContextValue = {
  recipes: Recipe[];
  logs: CookingLog[];
  ingredients: IngredientMapping[];
  importJobs: ImportJobSummary[];
  sourceVideos: SourceVideo[];
  ready: boolean;
  authResolved: boolean;
  authenticated: boolean;
  isDemo: boolean;
  cloudStatus: "loading" | "unconfigured" | "signed_out" | "connected" | "error";
  cloudError: string;
  saveRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  addLog: (log: CookingLog) => void;
  saveIngredient: (item: IngredientMapping) => void;
  importVideos: (videos: NormalizedFavoriteVideo[], metadata: { collectionId?: string; fileName?: string; skipped?: number }) => Promise<ImportResult>;
  refreshCloudData: () => Promise<void>;
  resetDemo: () => void;
};

const CookingContext = createContext<ContextValue | null>(null);
const KEYS = { recipes:"cookingapp.recipes.v1", logs:"cookingapp.logs.v1", ingredients:"cookingapp.ingredients.v1" };

export function CookingProvider({ children }: { children: React.ReactNode }) {
  const [recipes,setRecipes] = useState<Recipe[]>([]);
  const [logs,setLogs] = useState<CookingLog[]>([]);
  const [ingredients,setIngredients] = useState<IngredientMapping[]>([]);
  const [importJobs,setImportJobs] = useState<ImportJobSummary[]>([]);
  const [sourceVideos,setSourceVideos] = useState<SourceVideo[]>([]);
  const [ready,setReady] = useState(false);
  const [authResolved,setAuthResolved] = useState(false);
  const [authenticated,setAuthenticated] = useState(false);
  const [isDemo,setIsDemo] = useState(true);
  const [cloudStatus,setCloudStatus] = useState<ContextValue["cloudStatus"]>("loading");
  const [cloudError,setCloudError] = useState("");

  useEffect(() => {
    let active=true;
    let request=0;
    let initialSessionHandled=false;
    let loadedUserId:string|null=null;
    let loadingUserId:string|null=null;
    let unsubscribe:(()=>void)|undefined;

    // The hosted app is cloud-only. Never leave private cloud records in the
    // browser's demo cache after sign-out, session expiry, or a config error.
    Object.values(KEYS).forEach(key=>localStorage.removeItem(key));

    const start=async()=>{
      const supabase=await connectSupabase();
      if(!active)return;
      if(!supabase){
        setRecipes([]);setLogs([]);setIngredients([]);setImportJobs([]);setSourceVideos([]);
        setIsDemo(false);setAuthenticated(false);setAuthResolved(true);setCloudStatus("unconfigured");setReady(true);
        return;
      }

      const handleSession=async(session:Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"])=>{
      const current=++request;
      if(!session){
        if(!active)return;
        loadedUserId=null;
        setRecipes([]);setLogs([]);setIngredients([]);setImportJobs([]);setSourceVideos([]);
        setIsDemo(false);setAuthenticated(false);setAuthResolved(true);setCloudError("");setCloudStatus("signed_out");setReady(true);
        return;
      }
      setAuthenticated(true);setAuthResolved(true);
      if(loadedUserId===session.user.id||loadingUserId===session.user.id)return;
      loadingUserId=session.user.id;
      setCloudStatus("loading");setCloudError("");
      try{
        const cloud=await loadCloudData(session.user.id);
        if(!active||current!==request||!cloud)return;
        setRecipes(cloud.recipes);setLogs(cloud.logs);setIngredients(cloud.ingredients);setImportJobs(cloud.importJobs);setSourceVideos(cloud.sourceVideos);
        loadedUserId=session.user.id;
        setIsDemo(false);setCloudStatus("connected");
      }catch(e){
        if(!active||current!==request)return;
        setRecipes([]);setLogs([]);setIngredients([]);setImportJobs([]);setSourceVideos([]);
        setCloudError(e instanceof Error?e.message:"云端数据读取失败");setCloudStatus("error");
      }finally{
        if(loadingUserId===session.user.id)loadingUserId=null;
        if(active&&current===request)setReady(true);
      }
      };

      const resolveInitialSession=(session:Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"])=>{
        if(initialSessionHandled)return;
        initialSessionHandled=true;
        void handleSession(session);
      };
      const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
        if(event==="PASSWORD_RECOVERY"&&!location.href.includes("/login?mode=recovery")){
          location.replace("/login?mode=recovery");
          return;
        }
        if(event==="INITIAL_SESSION"){
          window.setTimeout(()=>resolveInitialSession(session),0);
          return;
        }
        if(event==="SIGNED_OUT"){
          window.setTimeout(()=>void handleSession(null),0);
          return;
        }
        if(event==="SIGNED_IN")window.setTimeout(()=>void handleSession(session),0);
      });
      supabase.auth.getSession().then(({data})=>resolveInitialSession(data.session));
      unsubscribe=()=>subscription.unsubscribe();
    };
    void start();
    return()=>{active=false;unsubscribe?.();};
  },[]);
  useEffect(() => { if(ready&&isDemo) localStorage.setItem(KEYS.recipes,JSON.stringify(recipes)); },[recipes,ready,isDemo]);
  useEffect(() => { if(ready&&isDemo) localStorage.setItem(KEYS.logs,JSON.stringify(logs)); },[logs,ready,isDemo]);
  useEffect(() => { if(ready&&isDemo) localStorage.setItem(KEYS.ingredients,JSON.stringify(ingredients)); },[ingredients,ready,isDemo]);

  const refreshCloudData = useCallback(async()=>{
    const s=getSupabase();
    if(!s)return;
    const {data:{user}}=await s.auth.getUser();
    if(!user)return;
    const cloud=await loadCloudData(user.id);
    if(!cloud)return;
    setRecipes(cloud.recipes);setLogs(cloud.logs);setIngredients(cloud.ingredients);setImportJobs(cloud.importJobs);setSourceVideos(cloud.sourceVideos);
    setIsDemo(false);setCloudError("");setCloudStatus("connected");setReady(true);
  },[]);

  const saveRecipe = useCallback((recipe: Recipe) => { setRecipes(old => {
    const exists = old.some(item => item.id === recipe.id);
    return exists ? old.map(item => item.id === recipe.id ? recipe : item) : [recipe,...old];
  }); persistRecipe(recipe).catch(e=>setCloudError(e.message)); },[]);
  const deleteRecipe = useCallback((id:string) => { setRecipes(old=>old.filter(r=>r.id!==id)); setLogs(old=>old.filter(l=>l.recipeId!==id)); removeCloudRecipe(id).catch(e=>setCloudError(e.message)); },[]);
  const addLog = useCallback((log:CookingLog) => {setLogs(old=>[log,...old]);persistLog(log).catch(e=>setCloudError(e.message));},[]);
  const saveIngredient = useCallback((item:IngredientMapping) => {setIngredients(old=>old.some(i=>i.id===item.id)?old.map(i=>i.id===item.id?item:i):[item,...old]);persistIngredient(item).catch(e=>setCloudError(e.message));},[]);
  const importVideos = useCallback(async(videos:NormalizedFavoriteVideo[],metadata:{collectionId?:string;fileName?:string;skipped?:number}) => {
    try{
      const cloudResult=await importBilibiliFavorites(videos,metadata);
      if(cloudResult){const s=getSupabase();const {data:{user}}=await s!.auth.getUser();if(user){const cloud=await loadCloudData(user.id);if(cloud){setRecipes(cloud.recipes);setImportJobs(cloud.importJobs);setSourceVideos(cloud.sourceVideos);setIsDemo(false);setCloudStatus("connected");}}return{...cloudResult,total:cloudResult.total+(metadata.skipped||0),skipped:cloudResult.skipped+(metadata.skipped||0)};}
    }catch(e){setCloudError(e instanceof Error?e.message:"云端导入失败");setCloudStatus("error");throw e;}
    const existing=new Set(recipes.map(r=>r.source?.bvid).filter(Boolean));const items:ImportResult["items"]=[];const additions:Recipe[]=[];
    videos.forEach(video=>{if(existing.has(video.bvid)){items.push({externalId:video.bvid,title:video.title,status:"duplicate"});return;}existing.add(video.bvid);additions.push(recipeFromFavoriteVideo(video));items.push({externalId:video.bvid,title:video.title,status:"processed"});});
    setRecipes(old=>[...additions.reverse(),...old]);
    const jobId=crypto.randomUUID(),now=new Date().toISOString(),result:ImportResult={jobId,mode:"local",total:videos.length+(metadata.skipped||0),added:additions.length,duplicates:items.filter(i=>i.status==="duplicate").length,failed:0,skipped:metadata.skipped||0,items};
    setImportJobs(old=>[{id:jobId,fileName:metadata.fileName,sourceCollectionId:metadata.collectionId,status:"completed",total:result.total,added:result.added,duplicates:result.duplicates,failed:0,skipped:result.skipped,createdAt:now,finishedAt:now},...old]);return result;
  },[recipes]);
  const resetDemo = useCallback(() => { setRecipes(demoRecipes); setLogs(demoLogs); setIngredients(demoIngredients); },[]);
  const value=useMemo(()=>({recipes,logs,ingredients,importJobs,sourceVideos,ready,authResolved,authenticated,isDemo,cloudStatus,cloudError,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,refreshCloudData,resetDemo}),[recipes,logs,ingredients,importJobs,sourceVideos,ready,authResolved,authenticated,isDemo,cloudStatus,cloudError,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,refreshCloudData,resetDemo]);
  return <CookingContext.Provider value={value}>{children}</CookingContext.Provider>;
}

export function useCooking() {
  const value=useContext(CookingContext); if(!value) throw new Error("useCooking must be used within CookingProvider"); return value;
}
