"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoIngredients, demoLogs, demoRecipes } from "@/lib/demo-data";
import type { CookingLog, FavoriteVideo, IngredientMapping, Recipe } from "@/lib/types";
import { getSupabase, loadCloudData, persistIngredient, persistLog, persistRecipe, removeCloudRecipe } from "@/lib/supabase";

type ContextValue = {
  recipes: Recipe[];
  logs: CookingLog[];
  ingredients: IngredientMapping[];
  ready: boolean;
  isDemo: boolean;
  cloudError: string;
  saveRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  addLog: (log: CookingLog) => void;
  saveIngredient: (item: IngredientMapping) => void;
  importVideos: (videos: FavoriteVideo[]) => number;
  resetDemo: () => void;
};

const CookingContext = createContext<ContextValue | null>(null);
const KEYS = { recipes:"cookingapp.recipes.v1", logs:"cookingapp.logs.v1", ingredients:"cookingapp.ingredients.v1" };

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

export function CookingProvider({ children }: { children: React.ReactNode }) {
  const [recipes,setRecipes] = useState<Recipe[]>(demoRecipes);
  const [logs,setLogs] = useState<CookingLog[]>(demoLogs);
  const [ingredients,setIngredients] = useState<IngredientMapping[]>(demoIngredients);
  const [ready,setReady] = useState(false);
  const [isDemo,setIsDemo] = useState(true);
  const [cloudError,setCloudError] = useState("");

  useEffect(() => {
    const timer=window.setTimeout(()=>{
      const localRecipes=load(KEYS.recipes,demoRecipes), localLogs=load(KEYS.logs,demoLogs), localIngredients=load(KEYS.ingredients,demoIngredients);
      setRecipes(localRecipes);setLogs(localLogs);setIngredients(localIngredients);
      const supabase=getSupabase();
      if(!supabase){setReady(true);return;}
      supabase.auth.getSession().then(async({data})=>{
        if(!data.session){setReady(true);return;}
        try{const cloud=await loadCloudData(data.session.user.id);if(cloud){if(cloud.recipes.length)setRecipes(cloud.recipes);if(cloud.logs.length)setLogs(cloud.logs);if(cloud.ingredients.length)setIngredients(cloud.ingredients);setIsDemo(false);}}
        catch(e){setCloudError(e instanceof Error?e.message:"云端数据读取失败");}
        finally{setReady(true);}
      });
    },0);
    return()=>window.clearTimeout(timer);
  },[]);
  useEffect(() => { if(ready) localStorage.setItem(KEYS.recipes,JSON.stringify(recipes)); },[recipes,ready]);
  useEffect(() => { if(ready) localStorage.setItem(KEYS.logs,JSON.stringify(logs)); },[logs,ready]);
  useEffect(() => { if(ready) localStorage.setItem(KEYS.ingredients,JSON.stringify(ingredients)); },[ingredients,ready]);

  const saveRecipe = useCallback((recipe: Recipe) => { setRecipes(old => {
    const exists = old.some(item => item.id === recipe.id);
    return exists ? old.map(item => item.id === recipe.id ? recipe : item) : [recipe,...old];
  }); persistRecipe(recipe).catch(e=>setCloudError(e.message)); },[]);
  const deleteRecipe = useCallback((id:string) => { setRecipes(old=>old.filter(r=>r.id!==id)); setLogs(old=>old.filter(l=>l.recipeId!==id)); removeCloudRecipe(id).catch(e=>setCloudError(e.message)); },[]);
  const addLog = useCallback((log:CookingLog) => {setLogs(old=>[log,...old]);persistLog(log).catch(e=>setCloudError(e.message));},[]);
  const saveIngredient = useCallback((item:IngredientMapping) => {setIngredients(old=>old.some(i=>i.id===item.id)?old.map(i=>i.id===item.id?item:i):[item,...old]);persistIngredient(item).catch(e=>setCloudError(e.message));},[]);
  const importVideos = useCallback((videos:FavoriteVideo[]) => {
    let added = 0;
    setRecipes(old => {
      const existing = new Set(old.map(r=>r.source?.bvid).filter(Boolean));
      const next = [...old];
      videos.forEach((video,index) => {
        const bvid = String(video.bvid || video.bvId || video.id || `import-${Date.now()}-${index}`);
        if(existing.has(bvid)) return;
        existing.add(bvid); added += 1;
        const recipe:Recipe={
          id:`video-${bvid.toLowerCase()}`, title:video.title || "待整理视频", summary:video.description || "已从 B 站收藏夹导入，等待整理为结构化菜谱。",
          emoji:"🎬", color:"linear-gradient(135deg,#d8d3c9,#9ca69f)", servings:2,totalMinutes:0,difficulty:"简单",status:"inbox",visibility:"private",tags:["待整理","B站导入"],tools:[],
          source:{platform:"Bilibili",title:video.title||"未命名视频",url:video.url||`https://www.bilibili.com/video/${bvid}`,bvid,uploader:video.uploader||video.author||""},
          ingredients:[],steps:[],versionNote:"由收藏夹 JSON 导入，配料与步骤尚待人工核验。",updatedAt:new Date().toISOString().slice(0,10)
        };next.unshift(recipe);persistRecipe(recipe).catch(e=>setCloudError(e.message));
      });
      return next;
    });
    return added;
  },[]);
  const resetDemo = useCallback(() => { setRecipes(demoRecipes); setLogs(demoLogs); setIngredients(demoIngredients); },[]);
  const value=useMemo(()=>({recipes,logs,ingredients,ready,isDemo,cloudError,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,resetDemo}),[recipes,logs,ingredients,ready,isDemo,cloudError,saveRecipe,deleteRecipe,addLog,saveIngredient,importVideos,resetDemo]);
  return <CookingContext.Provider value={value}>{children}</CookingContext.Provider>;
}

export function useCooking() {
  const value=useContext(CookingContext); if(!value) throw new Error("useCooking must be used within CookingProvider"); return value;
}
