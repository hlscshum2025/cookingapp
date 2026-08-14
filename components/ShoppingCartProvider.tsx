"use client";

import { createContext,useContext,useEffect,useMemo,useState } from "react";
import type { Recipe } from "@/lib/types";
import { connectSupabase } from "@/lib/supabase";

export type CartRecipe={id:string;title:string;servings:number;ingredients:Recipe["ingredients"]};
type CartContextValue={
  items:CartRecipe[];
  purchasedKeys:string[];
  ready:boolean;
  has:(id:string)=>boolean;
  isPurchased:(key:string)=>boolean;
  add:(recipe:Recipe)=>void;
  remove:(id:string)=>void;
  togglePurchased:(key:string)=>void;
  clearPurchased:()=>void;
  clear:()=>void;
};
const CartContext=createContext<CartContextValue|null>(null);

export function ShoppingCartProvider({children}:{children:React.ReactNode}){
  const [items,setItems]=useState<CartRecipe[]>([]);
  const [purchasedKeys,setPurchasedKeys]=useState<string[]>([]);
  const [key,setKey]=useState("");
  const [purchasedKey,setPurchasedKey]=useState("");
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;let unsubscribe:(()=>void)|undefined;
    const load=async()=>{
      const s=await connectSupabase();
      if(!s){
        if(active){
          const next="cookingapp:recipe-cart:local";
          const bought="cookingapp:shopping-purchased:local";
          setKey(next);setPurchasedKey(bought);
          try{setItems(JSON.parse(localStorage.getItem(next)||"[]") as CartRecipe[]);}catch{setItems([]);}
          try{setPurchasedKeys(JSON.parse(localStorage.getItem(bought)||"[]") as string[]);}catch{setPurchasedKeys([]);}
          setReady(true);
        }
        return;
      }
      const apply=(userId?:string)=>{
        if(!active)return;
        const next=`cookingapp:recipe-cart:${userId||"signed-out"}`;
        const bought=`cookingapp:shopping-purchased:${userId||"signed-out"}`;
        setKey(next);setPurchasedKey(bought);
        try{setItems(JSON.parse(localStorage.getItem(next)||"[]") as CartRecipe[]);}catch{setItems([]);}
        try{setPurchasedKeys(JSON.parse(localStorage.getItem(bought)||"[]") as string[]);}catch{setPurchasedKeys([]);}
        setReady(true);
      };
      const {data:{user}}=await s.auth.getUser();apply(user?.id);
      const {data:{subscription}}=s.auth.onAuthStateChange((_event,session)=>apply(session?.user.id));
      unsubscribe=()=>subscription.unsubscribe();
    };
    void load();
    return()=>{active=false;unsubscribe?.();};
  },[]);
  useEffect(()=>{if(ready&&key)localStorage.setItem(key,JSON.stringify(items));},[items,key,ready]);
  useEffect(()=>{if(ready&&purchasedKey)localStorage.setItem(purchasedKey,JSON.stringify(purchasedKeys));},[purchasedKeys,purchasedKey,ready]);
  const value=useMemo<CartContextValue>(()=>({
    items,
    purchasedKeys,
    ready,
    has:id=>items.some(item=>item.id===id),
    isPurchased:itemKey=>purchasedKeys.includes(itemKey),
    add:recipe=>setItems(old=>old.some(item=>item.id===recipe.id)?old:[...old,{id:recipe.id,title:recipe.title,servings:recipe.servings,ingredients:recipe.ingredients}]),
    remove:id=>setItems(old=>old.filter(item=>item.id!==id)),
    togglePurchased:itemKey=>setPurchasedKeys(old=>old.includes(itemKey)?old.filter(keyValue=>keyValue!==itemKey):[...old,itemKey]),
    clearPurchased:()=>setPurchasedKeys([]),
    clear:()=>{setItems([]);setPurchasedKeys([]);},
  }),[items,purchasedKeys,ready]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useRecipeCart(){const value=useContext(CartContext);if(!value)throw new Error("useRecipeCart must be used within ShoppingCartProvider");return value;}
