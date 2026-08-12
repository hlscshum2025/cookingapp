"use client";

import Link from "next/link";
import { useState } from "react";
import { useRecipeCart } from "./ShoppingCartProvider";

export function FloatingRecipeCart(){
  const {items,remove,clear}=useRecipeCart();const [open,setOpen]=useState(false);
  return <div className="recipe-cart-float">
    {open&&<section className="recipe-cart-popover" aria-label="已选菜谱">
      <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">SHOPPING CART</p><h2>已选菜谱</h2></div>{items.length>0&&<button className="auth-link" type="button" onClick={clear}>清空</button>}</div>
      {items.length?<div className="recipe-cart-list">{items.map(item=><div key={item.id}><span><b>{item.title}</b><small>{item.ingredients.length} 种食材</small></span><button type="button" className="icon-btn" aria-label={`移除 ${item.title}`} onClick={()=>remove(item.id)}>×</button></div>)}</div>:<p className="subtitle">还没有选菜。去菜谱库或标签总览把想做的菜加入这里。</p>}
      <Link href="/translations" className={`btn btn-primary ${!items.length?"disabled":""}`} style={{width:"100%",marginTop:14}} onClick={()=>setOpen(false)}>生成采购清单 →</Link>
    </section>}
    <button type="button" className="recipe-cart-button" aria-label={`采购车，${items.length} 道菜`} onClick={()=>setOpen(value=>!value)}><span>🛒</span>{items.length>0&&<b>{items.length}</b>}</button>
  </div>;
}
