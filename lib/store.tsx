"use client";
import { createContext,useContext,useEffect,useMemo,useState } from "react";
import { demoRecipes } from "./demo-data";
import type { Recipe,SourceVideo } from "./types";
type Store={recipes:Recipe[];sources:SourceVideo[];saveRecipe:(r:Recipe)=>void;removeRecipe:(id:string)=>void;importSources:(s:SourceVideo[])=>{added:number;duplicates:number};exportData:()=>void;demoMode:boolean};
const C=createContext<Store|null>(null); const KEY="cookingapp-v1";
export function StoreProvider({children}:{children:React.ReactNode}){const [recipes,setRecipes]=useState<Recipe[]>(demoRecipes);const [sources,setSources]=useState<SourceVideo[]>([]);const demoMode=!process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_PROJECT");
 useEffect(()=>{try{const v=localStorage.getItem(KEY);if(v){const d=JSON.parse(v);setRecipes(d.recipes||demoRecipes);setSources(d.sources||[])}}catch{}},[]);
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify({recipes,sources}))},[recipes,sources]);
 const value=useMemo<Store>(()=>({recipes,sources,demoMode,saveRecipe:r=>setRecipes(x=>[r,...x.filter(y=>y.id!==r.id)]),removeRecipe:id=>setRecipes(x=>x.filter(y=>y.id!==id)),importSources:incoming=>{let added=0,duplicates=0;setSources(current=>{const keys=new Set(current.map(v=>v.externalId));const unique=incoming.filter(v=>{if(keys.has(v.externalId)){duplicates++;return false}keys.add(v.externalId);added++;return true});return [...unique,...current]});return{added,duplicates}},exportData:()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),recipes,sources},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`cookingapp-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}}),[recipes,sources,demoMode]);return <C.Provider value={value}>{children}</C.Provider>}
export function useStore(){const x=useContext(C);if(!x)throw new Error("StoreProvider missing");return x}
