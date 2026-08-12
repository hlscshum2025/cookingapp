"use client";

import { useMemo,useState } from "react";
import Link from "next/link";
import { useRecipeCart } from "@/components/ShoppingCartProvider";
import { buildShoppingList,shoppingListToCsv,shoppingListToText } from "@/lib/shopping-list";
import { purchaseChannelLabels,type PurchaseChannel } from "@/lib/kitchen-dictionary";

type Filter="all"|"german"|"asian";

export default function TranslationsPage(){
  const {items,remove,clear}=useRecipeCart();const [filter,setFilter]=useState<Filter>("all");const [copied,setCopied]=useState(false);
  const lines=useMemo(()=>buildShoppingList(items),[items]);
  const visible=useMemo(()=>lines.filter(line=>filter==="all"||(filter==="german"&&(line.channel==="german_supermarket"||line.channel==="both"))||(filter==="asian"&&line.channel==="asian_market")),[lines,filter]);
  const matched=lines.filter(line=>line.matched).length;const unknown=lines.length-matched;
  const copy=async()=>{await navigator.clipboard.writeText(shoppingListToText(visible));setCopied(true);window.setTimeout(()=>setCopied(false),1400);};
  const download=()=>{const blob=new Blob([shoppingListToCsv(visible)],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`cookingapp-shopping-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);};
  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">PROCUREMENT</p><h1>采购清单</h1><p className="subtitle">这里不再维护翻译。先在菜谱库或标签总览把菜加入采购车，再把所有食材统一合并、分区和导出。</p></div><Link className="btn btn-secondary" href="/ingredients">打开厨房词典</Link></header>
    {!items.length?<div className="panel empty"><span>🛒</span><h2>采购车还是空的</h2><p>去菜谱库或标签总览，点击菜谱右下角的小购物车。选中的菜会一直保留在当前账号的这个浏览器里。</p><div style={{display:"flex",gap:10,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}><Link className="btn btn-primary" href="/recipes">去菜谱库选菜</Link><Link className="btn btn-secondary" href="/tags">按标签找菜</Link></div></div>:<>
      <section className="panel" style={{marginBottom:18}}><div className="section-head"><div><p className="eyebrow">SELECTED RECIPES</p><h2>{items.length} 道菜</h2></div><button className="btn btn-secondary" onClick={()=>{if(confirm("清空采购车中的全部菜谱吗？"))clear()}}>清空采购车</button></div><div className="tag-row" style={{gap:8}}>{items.map(item=><button type="button" className="tag" key={item.id} onClick={()=>remove(item.id)} title="点击从采购车移除">{item.title} ×</button>)}</div></section>
      <div className="stats" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:18}}><div className="stat"><div className="stat-label">合并后食材</div><div className="stat-value">{lines.length}</div></div><div className="stat"><div className="stat-label">词典已匹配</div><div className="stat-value">{matched}</div></div><div className="stat"><div className="stat-label">待补词典</div><div className="stat-value">{unknown}</div></div></div>
      <div className="search-panel"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className={`btn ${filter==="all"?"btn-primary":"btn-secondary"}`} onClick={()=>setFilter("all")}>全部 · {lines.length}</button><button className={`btn ${filter==="german"?"btn-primary":"btn-secondary"}`} onClick={()=>setFilter("german")}>德国普通超市 · {lines.filter(x=>x.channel==="german_supermarket"||x.channel==="both").length}</button><button className={`btn ${filter==="asian"?"btn-primary":"btn-secondary"}`} onClick={()=>setFilter("asian")}>亚超优先 · {lines.filter(x=>x.channel==="asian_market").length}</button></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn btn-secondary" disabled={!visible.length} onClick={copy}>{copied?"已复制":"复制当前清单"}</button><button className="btn btn-primary" disabled={!visible.length} onClick={download}>导出 CSV</button></div></div>
      <div className="table-wrap"><table><thead><tr><th>购买</th><th>食材</th><th>用量</th><th>Deutsch</th><th>采购分区</th><th>来自菜谱</th></tr></thead><tbody>{visible.map(line=><tr key={line.key}><td>□</td><td><b>{line.canonicalName}</b>{line.displayName!==line.canonicalName&&<><br/><small>原文：{line.displayName}</small></>}</td><td>{line.amounts.join(" + ")}</td><td>{line.de}<br/><small>{line.en}</small></td><td><span className={`badge ${line.channel==="asian_market"?"warn":""}`}>{purchaseChannelLabels[line.channel]}</span><br/><small>{line.shelfHint}</small></td><td>{line.recipes.join("、")}</td></tr>)}</tbody></table></div>
      {unknown>0&&<div className="notice" style={{marginTop:16,background:"#fff1cc",color:"#6d4d00"}}><b>{unknown} 个食材没有匹配到内置厨房词典。</b><br/>第一版暂时把它们归到“亚超优先 / 待确认”，避免误导成德超一定可以买到。可以到厨房词典继续补词。</div>}
      <div className="notice" style={{marginTop:16}}>同一种食材在不同菜谱里如果单位不一致，例如“30 g”和“2 勺”，第一版不会擅自换算，会把两个用量并列显示。后续再加入单位换算和按份数缩放。</div>
    </>}
  </div>;
}
