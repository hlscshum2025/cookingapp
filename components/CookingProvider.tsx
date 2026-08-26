"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoIngredients, demoLogs, demoRecipes } from "@/lib/demo-data";
import type { CookingLog, ImportJobSummary, ImportResult, IngredientMapping, NormalizedFavoriteVideo, Recipe, SourceVideo } from "@/lib/types";
import { connectSupabase, getSessionUser, getSupabase, importBilibiliFavorites, loadCloudData, loadCloudRecipe, persistIngredient, persistLog, persistRecipe, removeCloudRecipe } from "@/lib/supabase";

type ContextValue = {
  recipes: Recipe[];
  logs: CookingLog[];
  ingredients: IngredientMapping[];
  importJobs: ImportJobSummary[];
  sourceVideos: SourceVideo[];
  ready: boolean;
  authResolved: boolean;
  authenticated: boolean;
  currentUserId: string;
  currentUserEmail: string;
  isDemo: boolean;
  cloudStatus: "loading" | "unconfigured" | "signed_out" | "connected" | "error";
  cloudError: string;
  lastCloudSync: string;
  saveRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (id: string) => void;
  addLog: (log: CookingLog) => void;
  saveIngredient: (item: IngredientMapping) => void;
  importVideos: (videos: NormalizedFavoriteVideo[], metadata: { collectionId?: string; fileName?: string; skipped?: number }) => Promise<ImportResult>;
  refreshCloudData: () => Promise<void>;
  refreshRecipe: (recipeId: string, completedSourceId?: string) => Promise<void>;
  resetDemo: () => void;
};

const CookingContext = createContext<ContextValue | null>(null);
const KEYS = { recipes:"cookingapp.recipes.v1", logs:"cookingapp.logs.v1", ingredients:"cookingapp.ingredients.v1" };
const CLOUD_CACHE_PREFIX="cookingapp.cloud-cache.v1.";
type CloudData=NonNullable<Awaited<ReturnType<typeof loadCloudData>>>;
type CloudCache={savedAt:string;data:CloudData};

function readCloudCache(userId:string):CloudCache|null{
  try{
    const value=JSON.parse(localStorage.getItem(`${CLOUD_CACHE_PREFIX}${userId}`)||"null") as CloudCache|null;
    return value&&typeof value.savedAt==="string"&&value.data?value:null;
  }catch{return null;}
}

function writeCloudCache(userId:string,data:CloudData,savedAt:string){
  try{localStorage.setItem(`${CLOUD_CACHE_PREFIX}${userId}`,JSON.stringify({savedAt,data} satisfies CloudCache));}catch{}
}

export function CookingProvider({ children }: { children: React.ReactNode }) {
  const [recipes,setRecipes] = useState<Recipe[]>([]);
  const [logs,setLogs] = useState<CookingLog[]>([]);
  const [ingredients,setIngredients] = useState<IngredientMapping[]>([]);
  const [importJobs,setImportJobs] = useState<ImportJobSummary[]>([]);
  const [sourceVideos,setSourceVideos] = useState<SourceVideo[]>([]);
  const [ready,setReady] = useState(false);
  const [authResolved,setAuthResolved] = useState(false);
  const [authenticated,setAuthenticated] = useState(false);
  const [currentUserId,setCurrentUserId] = useState("");
  const [currentUserEmail,setCurrentUserEmail] = useState("");
  const [isDemo,setIsDemo] = useState(true);
  const [cloudStatus,setCloudStatus] = useState<ContextValue["cloudStatus"]>("loading");
  const [cloudError,setCloudError] = useState("");
  const [lastCloudSync,setLastCloudSync] = useState("");
  const refreshInFlight=useRef<Promise<void>|null>(null);
  const retryAttempt=useRef(0);

  const applyCloudData=useCallback((cloud:CloudData,userId:string,savedAt=new Date().toISOString())=>{
    setRecipes(cloud.recipes);setLogs(cloud.logs);setIngredients(cloud.ingredients);setImportJobs(cloud.importJobs);setSourceVideos(cloud.sourceVideos);
    setLastCloudSync(savedAt);writeCloudCache(userId,cloud,savedAt);retryAttempt.current=0;
  },[]);

  useEffect(() => {
    let active=true;
    let request=0;
    let initialSessionHandled=false;
    let loadedUserId:string|null=null;
    let loadingUserId:string|null=null;
    let activeUserId:string|null=null;
    let unsubscribe:(()=>void)|undefined;
    Object.values(KEYS).forEach(key=>localStorage.removeItem(key));

    const start=async()=>{
      const supabase=await connectSupabase();
      if(!active)return;
      if(!supabase){
        setRecipes([]);setLogs([]);setIngredients([]);setImportJobs([]);setSourceVideos([]);
        setIsDemo(false);setAuthenticated(false);setCurrentUserId("");setCurrentUserEmail("");setAuthResolved(true);setCloudStatus("unconfigured");setReady(true);
        return;
      }

      const handleSession=async(session:Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"])=>{
        if(!session){
          request+=1;
          if(!active)return;
          if(activeUserId)try{localStorage.removeItem(`${CLOUD_CACHE_PREFIX}${activeUserId}`);}catch{}
          activeUserId=null;loadedUserId=null;
          setRecipes([]);setLogs([]);setIngredients([]);setImportJobs([]);setSourceVideos([]);
          setIsDemo(false);setAuthenticated(false);setCurrentUserId("");setCurrentUserEmail("");setLastCloudSync("");setAuthResolved(true);setCloudError("");setCloudStatus("signed_out");setReady(true);
          return;
        }
        if(activeUserId&&activeUserId!==session.user.id){
          try{localStorage.removeItem(`${CLOUD_CACHE_PREFIX}${activeUserId}`);}catch{}
          setRecipes([]);setLogs([]);setIngredients([]);setImportJobs([]);setSourceVideos([]);setLastCloudSync("");
          loadedUserId=null;loadingUserId=null;
        }
        activeUserId=session.user.id;
        setAuthenticated(true);setCurrentUserId(session.user.id);setCurrentUserEmail(session.user.email||"");setAuthResolved(true);
        if(loadedUserId===session.user.id||loadingUserId===session.user.id)return;
        const current=++request;
        const cached=readCloudCache(session.user.id);
        if(cached){applyCloudData(cached.data,session.user.id,cached.savedAt);setIsDemo(false);setReady(true);}
        loadingUserId=session.user.id;
        setCloudStatus("loading");setCloudError("");
        try{
          const cloud=await loadCloudData(session.user.id);
          if(!active||current!==request||!cloud)return;
          applyCloudData(cloud,session.user.id);
          loadedUserId=session.user.id;
          setIsDemo(false);setCloudStatus("connected");
        }catch(e){
          if(!active||current!==request)return;
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
        if(event==="INITIAL_SESSION"){window.setTimeout(()=>resolveInitialSession(session),0);return;}
        if(event==="SIGNED_OUT"){window.setTimeout(()=>void handleSession(null),0);return;}
        if(event==="SIGNED_IN"||event==="USER_UPDATED")window.setTimeout(()=>void handleSession(session),0);
        if(event==="TOKEN_REFRESHED"&&session){setCurrentUserId(session.user.id);setCurrentUserEmail(session.user.email||"");}
      });
      supabase.auth.getSession().then(({data})=>resolveInitialSession(data.session));
      unsubscribe=()=>subscription.unsubscribe();
    };
    void start();
    return()=>{active=false;unsubscribe?.();};
  },[applyCloudData]);

  useEffect(() => { if(ready&&isDemo) localStorage.setItem(KEYS.recipes,JSON.stringify(recipes)); },[recipes,ready,isDemo]);
  useEffect(() => { if(ready&&isDemo) localStorage.setItem(KEYS.logs,JSON.stringify(logs)); },[logs,ready,isDemo]);
  useEffect(() => { if(ready&&isDemo) localStorage.setItem(KEYS.ingredients,JSON.stringify(ingredients)); },[ingredients,ready,isDemo]);

  const refreshCloudData = useCallback(()=>{
    if(refreshInFlight.current)return refreshInFlight.current;
    const operation=(async()=>{
      setCloudStatus("loading");setCloudError("");
      try{
        const s=await connectSupabase();
        if(!s){setCloudStatus("unconfigured");throw new Error("Supabase 站点配置尚未就绪。");}
        const user=await getSessionUser(s);
        if(!user){setAuthenticated(false);setCurrentUserId("");setCurrentUserEmail("");setCloudStatus("signed_out");throw new Error("登录会话已失效，请重新登录。");}
        setAuthenticated(true);setAuthResolved(true);setCurrentUserId(user.id);setCurrentUserEmail(user.email||"");
        const cloud=await loadCloudData(user.id);
        if(!cloud)throw new Error("Supabase 客户端尚未就绪。");
        applyCloudData(cloud,user.id);
        setIsDemo(false);setCloudStatus("connected");setReady(true);
      }catch(error){
        const message=error instanceof Error?error.message:"云端数据读取失败";
        setCloudError(message);
        setCloudStatus(current=>current==="signed_out"||current==="unconfigured"?current:"error");
        throw error;
      }
    })().finally(()=>{refreshInFlight.current=null;});
    refreshInFlight.current=operation;
    return operation;
  },[applyCloudData]);

  useEffect(()=>{
    if(!authenticated||cloudStatus!=="error")return;
    const retry=()=>{
      if(!navigator.onLine||document.visibilityState==="hidden")return;
      retryAttempt.current+=1;
      void refreshCloudData().catch(()=>{});
    };
    const delay=Math.min(30_000,3_000*2**Math.min(retryAttempt.current,4));
    const timer=window.setTimeout(retry,delay);
    const online=()=>retry();
    const visible=()=>{if(document.visibilityState==="visible")retry();};
    window.addEventListener("online",online);
    document.addEventListener("visibilitychange",visible);
    return()=>{window.clearTimeout(timer);window.removeEventListener("online",online);document.removeEventListener("visibilitychange",visible);};
  },[authenticated,cloudStatus,refreshCloudData]);

  const refreshRecipe = useCallback(async(recipeId:string,completedSourceId?:string)=>{
    const recipe=await loadCloudRecipe(recipeId);
    if(recipe)setRecipes(old=>old.some(item=>item.id===recipe.id)?old.map(item=>item.id===recipe.id?recipe:item):[recipe,...old]);
    if(completedSourceId)setSourceVideos(old=>old.filter(item=>item.id!==completedSourceId));
    setIsDemo(false);setCloudError("");setCloudStatus("connected");setReady(true);
  },[]);

  const saveRecipe = useCallback(async(recipe: Recipe) => {
    setRecipes(old => old.some(item=>item.id===recipe.id)?old.map(item=>item.id===recipe.id?recipe:item):[recipe,...old]);
    try{await persistRecipe(recipe);setCloudError("");}
    catch(error){const message=error instanceof Error?error.message:"菜谱保存失败";setCloudError(message);throw error;}
  },[]);
  const deleteRecipe = useCallback((id:string) => { setRecipes(old=>old.filter(r=>r.id!==id)); setLogs(old=>old.filter(l=>l.recipeId!==id)); removeCloudRecipe(id).catch(e=>setCloudError(e.message)); },[]);
  const addLog = useCallback((log:CookingLog) => {setLogs(old=>[log,...old]);persistLog(log).catch(e=>setCloudError(e.message));},[]);
  const saveIngredient = useCallback((item:IngredientMapping) => {setIngredients(old=>old.some(i=>i.id===item.id)?old.map(i=>i.id===item.id?item:i):[item,...old]);persistIngredient(item).catch(e=>setCloudError(e.message));},[]);
  const importVideos = useCallback(async(videos:NormalizedFavoriteVideo[],metadata:{collectionId?:string;fileName?:string;skipped?:number}) => {
    try{
      const cloudResult=await importBilibiliFavorites(videos,metadata);
      if(cloudResult){
        const s=getSupabase();const user=await getSessionUser(s);
        if(user){const cloud=await loadCloudData(user.id);if(cloud){applyCloudData(cloud,user.id);setIsDemo(false);setCloudStatus("connected");}}
        return{...cloudResult,total:cloudResult.total+(metadata.skipped||0),skipped:cloudResult.skipped+(metadata.skipped||0)};
      }
    }catch(e){setCloudError(e instanceof Error?e.message:"云端导入失败");setCloudStatus("error");throw e;}
    // No-Supabase fallback never creates recipes: JSON import is source-only.
    const items:ImportResult["items"]=videos.map(video=>({externalId:video.bvid,title:video.title,status:"processed"}));
    const jobId=crypto.randomUUID(),now=new Date().toISOString(),result:ImportResult={jobId,mode:"local",total:videos.length+(metadata.skipped||0),added:videos.length,duplicates:0,failed:0,skipped:metadata.skipped||0,items};
    setImportJobs(old=>[{id:jobId,fileName:metadata.fileName,sourceCollectionId:metadata.collectionId,status:"completed",total:result.total,added:result.added,duplicates:0,failed:0,skipped:result.skipped,createdAt:now,finishedAt:now},...old]);
    return result;
  },[applyCloudData]);
  const resetDemo = useCallback(() => { setRecipes(demoRecipes); setLogs(demoLogs); setIngredients(demoIngredients); },[]);
  const value=useMemo(()=>({recipes,logs,ingredients,importJobs,sourceVideos,ready,authResolved,authenticated,currentUserId,currentUserEmail,isDemo,cloudStatus,cloudError,lastCloudSync,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,refreshCloudData,refreshRecipe,resetDemo}),[recipes,logs,ingredients,importJobs,sourceVideos,ready,authResolved,authenticated,currentUserId,currentUserEmail,isDemo,cloudStatus,cloudError,lastCloudSync,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,refreshCloudData,refreshRecipe,resetDemo]);
  return <CookingContext.Provider value={value}>{children}</CookingContext.Provider>;
}

export function useCooking() { const value=useContext(CookingContext); if(!value) throw new Error("useCooking must be used within CookingProvider"); return value; }
