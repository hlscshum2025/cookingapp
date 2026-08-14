"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { useCooking } from "./CookingProvider";
import { RecipeCard } from "./RecipeCard";
import { addPantryItemByName,loadPantryItems,removePantryItem,type PantryItem } from "@/lib/pantry";

export function Dashboard() {
  const {recipes,logs,cloudStatus}=useCooking();
  const successful=recipes.filter(r=>["successful","favorite"].includes(r.status)).length;
  const inbox=recipes.filter(r=>r.status==="inbox").length;
  const [pantry,setPantry]=useState<PantryItem[]>([]);
  const [pantryInput,setPantryInput]=useState("");
  const [pantryBusy,setPantryBusy]=useState(false);
  const [pantryError,setPantryError]=useState("");

  useEffect(()=>{
    let active=true;
    if(cloudStatus!=="connected"){setPantry([]);return()=>{active=false;};}
    loadPantryItems().then(rows=>{if(active)setPantry(rows);}).catch(reason=>{if(active)setPantryError(reason instanceof Error?reason.message:"线上冰箱读取失败。");});
    return()=>{active=false;};
  },[cloudStatus]);

  const addPantry=async()=>{
    if(!pantryInput.trim())return;
    setPantryBusy(true);setPantryError("");
    try{
      const saved=await addPantryItemByName(pantryInput);
      setPantry(old=>[saved,...old.filter(item=>item.id!==saved.id&&item.ingredientKey!==saved.ingredientKey)]);
      setPantryInput("");
    }catch(reason){setPantryError(reason instanceof Error?reason.message:"加入线上冰箱失败。");}
    finally{setPantryBusy(false);}
  };

  const useUp=async(item:PantryItem)=>{
    if(!window.confirm(`确定“${item.name}”已经用完了吗？\n\n确认后会从线上冰箱移除，之后采购清单会重新把它列为需要购买。`))return;
    setPantryError("");
    try{await removePantryItem(item.id);setPantry(old=>old.filter(value=>value.id!==item.id));}
    catch(reason){setPantryError(reason instanceof Error?reason.message:"移出线上冰箱失败。");}
  };

  return <div className="page">
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow" style={{color:"#f0c89e"}}>YOUR PERSONAL COOKBOOK</p><h1>今天，想做点<br/>真正成功过的。</h1><p>把 B 站收藏整理成自己的版本，记录每次调整；以后不再重新翻视频找克数和火候。</p><div className="hero-actions"><Link href="/recipes/new" className="btn btn-primary">＋ 新建菜谱</Link><Link href="/imports" className="btn btn-secondary">导入收藏夹</Link></div></div>
      <div className="hero-board"><div className="mini-stat"><strong>{successful}</strong><span>已验证成功</span></div><div className="mini-stat"><strong>{inbox}</strong><span>等待整理</span></div><div className="mini-stat"><strong>{logs.length}</strong><span>制作记录</span></div><div className="mini-stat"><strong>3</strong><span>中英德语言</span></div></div>
    </section>
    <section className="stats"><div className="stat"><div className="stat-label">全部菜谱</div><div className="stat-value">{recipes.length}</div><small>个人知识库</small></div><div className="stat"><div className="stat-label">常做</div><div className="stat-value">{recipes.filter(r=>r.status==="favorite").length}</div><small>随时可复刻</small></div><div className="stat"><div className="stat-label">待尝试</div><div className="stat-value">{recipes.filter(r=>r.status==="to_try").length}</div><small>下一批候选</small></div><div className="stat"><div className="stat-label">线上冰箱</div><div className="stat-value">{pantry.length}</div><small>已有食材 / 调料</small></div></section>

    <section className="panel" style={{marginTop:20,marginBottom:24}}>
      <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">ONLINE PANTRY</p><h2>线上冰箱</h2><p className="subtitle">把家里长期已有的调料、干货或食材放这里。采购清单会自动排除它们；用完时点“用完了”即可重新加入采购需求。</p></div><span className="badge">{pantry.length} 项库存</span></div>
      {cloudStatus==="connected"?<>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}><div className="field" style={{flex:"1 1 260px",margin:0}}><label>加入已有食材 / 调料</label><input value={pantryInput} onChange={event=>setPantryInput(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void addPantry();}}} placeholder="例如：酱油、盐、花椒、黄油"/></div><button className="btn btn-primary" type="button" disabled={pantryBusy||!pantryInput.trim()} onClick={()=>void addPantry()}>{pantryBusy?"正在保存…":"＋ 加入冰箱"}</button></div>
        {pantryError&&<div className="notice" role="alert" style={{marginTop:12,background:"#fbe5de",color:"#923c29"}}>{pantryError}</div>}
        {pantry.length?<div className="tag-row" style={{gap:10,marginTop:16}}>{pantry.map(item=><span className="tag" key={item.id} style={{display:"inline-flex",gap:8,alignItems:"center"}}><b>{item.name}</b><button type="button" className="auth-link" onClick={()=>void useUp(item)} title={`标记 ${item.name} 已用完`}>用完了</button></span>)}</div>:<div className="notice" style={{marginTop:16}}>线上冰箱还是空的。可以先把盐、糖、酱油、醋等常备调料加入；采购页面也能把买到的食材直接放进来。</div>}
      </>:<div className="notice">登录后线上冰箱会按账号保存在云端，并在不同设备之间同步。</div>}
      <div style={{marginTop:14}}><Link href="/translations" className="btn btn-secondary">打开采购清单 →</Link></div>
    </section>

    <div className="section-head"><h2>最近更新</h2><Link href="/recipes">查看全部 →</Link></div>
    <div className="recipe-grid">{recipes.slice(0,3).map(recipe=><RecipeCard recipe={recipe} key={recipe.id}/>)}</div>
  </div>;
}
