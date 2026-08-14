"use client";

import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { useRecipeCart } from "@/components/ShoppingCartProvider";
import { buildShoppingList,shoppingListToCsv,shoppingListToText,type ShoppingLine } from "@/lib/shopping-list";
import { purchaseChannelLabels } from "@/lib/kitchen-dictionary";
import { loadPantryItems,removePantryItem,savePantryItem,type PantryItem } from "@/lib/pantry";

type Filter="all"|"german"|"asian";

export default function TranslationsPage(){
  const {items,purchasedKeys,togglePurchased,clearPurchased,remove,clear}=useRecipeCart();
  const [filter,setFilter]=useState<Filter>("all");
  const [copied,setCopied]=useState(false);
  const [pantry,setPantry]=useState<PantryItem[]>([]);
  const [pantryBusy,setPantryBusy]=useState("");
  const [pantryError,setPantryError]=useState("");
  const lines=useMemo(()=>buildShoppingList(items),[items]);
  const pantryByKey=useMemo(()=>new Map(pantry.map(item=>[item.ingredientKey,item])),[pantry]);
  const purchasedSet=useMemo(()=>new Set(purchasedKeys),[purchasedKeys]);
  const visible=useMemo(()=>lines.filter(line=>filter==="all"||(filter==="german"&&(line.channel==="german_supermarket"||line.channel==="both"))||(filter==="asian"&&line.channel==="asian_market")),[lines,filter]);
  const exportable=useMemo(()=>visible.filter(line=>!purchasedSet.has(line.key)&&!pantryByKey.has(line.key)),[visible,purchasedSet,pantryByKey]);
  const matched=lines.filter(line=>line.matched).length;
  const unknown=lines.length-matched;
  const pantryCovered=lines.filter(line=>pantryByKey.has(line.key)).length;
  const purchased=lines.filter(line=>purchasedSet.has(line.key)&&!pantryByKey.has(line.key)).length;
  const needed=lines.length-pantryCovered-purchased;

  useEffect(()=>{
    let active=true;
    loadPantryItems().then(rows=>{if(active)setPantry(rows);}).catch(reason=>{if(active)setPantryError(reason instanceof Error?reason.message:"线上冰箱读取失败。");});
    return()=>{active=false;};
  },[]);

  const copy=async()=>{await navigator.clipboard.writeText(shoppingListToText(exportable));setCopied(true);window.setTimeout(()=>setCopied(false),1400);};
  const download=()=>{const blob=new Blob([shoppingListToCsv(exportable)],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`cookingapp-shopping-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);};

  const addToPantry=async(line:ShoppingLine)=>{
    setPantryBusy(line.key);setPantryError("");
    try{
      const saved=await savePantryItem({ingredientKey:line.key,name:line.canonicalName,category:line.category});
      setPantry(old=>[saved,...old.filter(item=>item.id!==saved.id&&item.ingredientKey!==saved.ingredientKey)]);
    }catch(reason){setPantryError(reason instanceof Error?reason.message:"加入线上冰箱失败。");}
    finally{setPantryBusy("");}
  };

  const removeFromPantry=async(line:ShoppingLine)=>{
    const item=pantryByKey.get(line.key);if(!item)return;
    if(!confirm(`确定“${item.name}”已经用完了吗？\n\n确认后会从线上冰箱移除，并重新出现在需要采购的清单里。`))return;
    setPantryBusy(line.key);setPantryError("");
    try{await removePantryItem(item.id);setPantry(old=>old.filter(value=>value.id!==item.id));}
    catch(reason){setPantryError(reason instanceof Error?reason.message:"移出线上冰箱失败。");}
    finally{setPantryBusy("");}
  };

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">PROCUREMENT</p><h1>采购清单</h1><p className="subtitle">勾选“已购买”只记录这一次采购；加入“线上冰箱”则作为长期库存。复制和 CSV 默认只导出真正还需要购买的食材。</p></div><Link className="btn btn-secondary" href="/ingredients">打开厨房词典</Link></header>
    {!items.length?<div className="panel empty"><span>🛒</span><h2>采购车还是空的</h2><p>去菜谱库或标签总览，点击菜谱右下角的小购物车。选中的菜会一直保留在当前账号的这个浏览器里。</p><div style={{display:"flex",gap:10,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}><Link className="btn btn-primary" href="/recipes">去菜谱库选菜</Link><Link className="btn btn-secondary" href="/tags">按标签找菜</Link></div></div>:<>
      <section className="panel" style={{marginBottom:18}}><div className="section-head"><div><p className="eyebrow">SELECTED RECIPES</p><h2>{items.length} 道菜</h2></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{purchasedKeys.length>0&&<button className="btn btn-secondary" onClick={clearPurchased}>清除已购买勾选</button>}<button className="btn btn-secondary" onClick={()=>{if(confirm("清空采购车中的全部菜谱吗？"))clear()}}>清空采购车</button></div></div><div className="tag-row" style={{gap:8}}>{items.map(item=><button type="button" className="tag" key={item.id} onClick={()=>remove(item.id)} title="点击从采购车移除">{item.title} ×</button>)}</div></section>
      <div className="stats" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",marginBottom:18}}><div className="stat"><div className="stat-label">合并后食材</div><div className="stat-value">{lines.length}</div></div><div className="stat"><div className="stat-label">还需购买</div><div className="stat-value">{needed}</div></div><div className="stat"><div className="stat-label">本次已购买</div><div className="stat-value">{purchased}</div></div><div className="stat"><div className="stat-label">冰箱已有</div><div className="stat-value">{pantryCovered}</div></div><div className="stat"><div className="stat-label">待补词典</div><div className="stat-value">{unknown}</div><small>已匹配 {matched}</small></div></div>
      <div className="search-panel"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className={`btn ${filter==="all"?"btn-primary":"btn-secondary"}`} onClick={()=>setFilter("all")}>全部 · {lines.length}</button><button className={`btn ${filter==="german"?"btn-primary":"btn-secondary"}`} onClick={()=>setFilter("german")}>德国普通超市 · {lines.filter(x=>x.channel==="german_supermarket"||x.channel==="both").length}</button><button className={`btn ${filter==="asian"?"btn-primary":"btn-secondary"}`} onClick={()=>setFilter("asian")}>亚超优先 · {lines.filter(x=>x.channel==="asian_market").length}</button></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn btn-secondary" disabled={!exportable.length} onClick={copy}>{copied?"已复制":`复制待购买 · ${exportable.length}`}</button><button className="btn btn-primary" disabled={!exportable.length} onClick={download}>导出 CSV · {exportable.length}</button></div></div>
      {pantryError&&<div className="notice" role="alert" style={{marginBottom:14,background:"#fbe5de",color:"#923c29"}}>{pantryError}</div>}
      <div className="table-wrap"><table><thead><tr><th>状态</th><th>食材</th><th>用量</th><th>Deutsch</th><th>采购分区</th><th>线上冰箱</th><th>来自菜谱</th></tr></thead><tbody>{visible.map(line=>{
        const pantryItem=pantryByKey.get(line.key);const bought=purchasedSet.has(line.key)&&!pantryItem;
        return <tr key={line.key} style={{opacity:pantryItem||bought?.72:1}}><td><label style={{display:"inline-flex",alignItems:"center",gap:7,cursor:pantryItem?"default":"pointer"}}><input type="checkbox" checked={bought||Boolean(pantryItem)} disabled={Boolean(pantryItem)} onChange={()=>togglePurchased(line.key)}/><span>{pantryItem?"冰箱已有":bought?"已购买":"待购买"}</span></label></td><td><b>{line.canonicalName}</b>{line.displayName!==line.canonicalName&&<><br/><small>原文：{line.displayName}</small></>}</td><td>{line.amounts.join(" + ")}</td><td>{line.de}<br/><small>{line.en}</small></td><td><span className={`badge ${line.channel==="asian_market"?"warn":""}`}>{purchaseChannelLabels[line.channel]}</span><br/><small>{line.shelfHint}</small></td><td>{pantryItem?<button type="button" className="btn btn-secondary" disabled={pantryBusy===line.key} onClick={()=>void removeFromPantry(line)}>{pantryBusy===line.key?"处理中…":"用完了"}</button>:<button type="button" className="btn btn-secondary" disabled={pantryBusy===line.key} onClick={()=>void addToPantry(line)}>{pantryBusy===line.key?"处理中…":"加入冰箱"}</button>}</td><td>{line.recipes.join("、")}</td></tr>;
      })}</tbody></table></div>
      {unknown>0&&<div className="notice" style={{marginTop:16,background:"#fff1cc",color:"#6d4d00"}}><b>{unknown} 个食材没有匹配到内置厨房词典。</b><br/>暂时把它们归到“亚超优先 / 待确认”，避免误导成德超一定可以买到。可以到厨房词典继续补词。</div>}
      <div className="notice" style={{marginTop:16}}>“已购买”是当前账号在这个浏览器里的临时采购状态；“线上冰箱”保存在账号云端并跨设备同步。同一种食材若单位不一致，例如“30 g”和“2 勺”，当前仍并列显示，不擅自换算。</div>
    </>}
  </div>;
}
