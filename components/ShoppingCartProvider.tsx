"use client";

import { createContext,useContext,useEffect,useMemo,useState } from "react";
import type { Recipe } from "@/lib/types";
import { connectSupabase } from "@/lib/supabase";

export type CartRecipe={id:string;title:string;servings:number;ingredients:Recipe["ingredients"]};
type CartContextValue={items:CartRecipe[];ready:boolean;has:(id:string)=>boolean;add:(recipe:Recipe)=>void;remove:(id:string)=>void;clear:()=>void};
const CartContext=createContext<CartContextValue|null>(null);

export function ShoppingCartProvider({children}:{children:React.ReactNode}){
  const [items,setItems]=useState<CartRecipe[]>([]);const [key,setKey]=useState("");const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;let unsubscribe:(()=>void)|undefined;
    const load=async()=>{
      const s=await connectSupabase();
      if(!s){if(active){setKey("cookingapp:recipe-cart:local");setReady(true);}return;}
      const apply=(userId?:string)=>{
        if(!active)return;
        const next=`cookingapp:recipe-cart:${userId||"signed-out"}`;setKey(next);
        try{setItems(JSON.parse(localStorage.getItem(next)||"[]") as CartRecipe[]);}catch{setItems([]);}setReady(true);
      };
      const {data:{user}}=await s.auth.getUser();apply(user?.id);
      const {data:{subscription}}=s.auth.onAuthStateChange((_event,session)=>apply(session?.user.id));
      unsubscribe=()=>subscription.unsubscribe();
    };void load();return()=>{active=false;unsubscribe?.();};
  },[]);
  useEffect(()=>{if(ready&&key)localStorage.setItem(key,JSON.stringify(items));},[items,key,ready]);
  const value=useMemo<CartContextValue>(()=>({items,ready,has:id=>items.some(item=>item.id===id),add:recipe=>setItems(old=>old.some(item=>item.id===recipe.id)?old:[...old,{id:recipe.id,title:recipe.title,servings:recipe.servings,ingredients:recipe.ingredients}]),remove:id=>setItems(old=>old.filter(item=>item.id!==id)),clear:()=>setItems([])}),[items,ready]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useRecipeCart(){const value=useContext(CartContext);if(!value)throw new Error("useRecipeCart must be used within ShoppingCartProvider");return value;}
