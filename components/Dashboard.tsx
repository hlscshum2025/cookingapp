"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { useCooking } from "./CookingProvider";
import { RecipeCard } from "./RecipeCard";
import { addPantryItemByName,loadPantryItems,removePantryItems,type PantryItem,type PantryLocation } from "@/lib/pantry";

export function Dashboard() {
  const {recipes,logs,cloudStatus}=useCooking();
  const successful=recipes.filter(r=>["successful","favorite"].includes(r.status)).length;
  const inbox=recipes.filter(r=>r.status==="inbox").length;
  const [pantry,setPantry]=useState<PantryItem[]>([]);
  const [pantryInputs,setPantryInputs]=useState<Record<PantryLocation,string>>({fridge:"",cabinet:""});
  const [deleteQueue,setDeleteQueue]=useState<string[]>([]);
  const [pantryBusy,setPantryBusy]=useState(false);
  const [pantryError,setPantryError]=useState("");

  useEffect(()=>{
    let active=true;
    if(cloudStatus!=="connected"){setPantry([]);return()=>{active=false;};}
    loadPantryItems().then(rows=>{if(active)setPantry(rows);}).catch(reason=>{if(active)setPantryError(reason instanceof Error?reason.message:"线上冰箱读取失败。");});
    return()=>{active=false;};
  },[cloudStatus]);

  const addPantry=async(location:PantryLocation)=>{
    const value=pantryInputs[location];
    if(!value.trim())return;
    setPantryBusy(true);setPantryError("");
    try{
      const saved=await addPantryItemByName(value,location);
      setPantry(old=>[saved,...old.filter(item=>item.id!==saved.id&&item.ingredientKey!==saved.ingredientKey)]);
      setPantryInputs(old=>({...old,[location]:""}));
    }catch(reason){setPantryError(reason instanceof Error?reason.message:"加入线上冰箱失败。");}
    finally{setPantryBusy(false);}
  };

  const toggleDelete=(id:string)=>setDeleteQueue(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);
  const confirmDelete=async()=>{
    if(!deleteQueue.length)return;
    const names=pantry.filter(item=>deleteQueue.includes(item.id)).map(item=>item.name);
    if(!window.confirm(`确认统一删除 ${deleteQueue.length} 项库存吗？\n\n${names.join("、")}\n\n删除后采购清单会重新把它们列为需要购买。`))return;
    setPantryBusy(true);setPantryError("");
    try{await removePantryItems(deleteQueue);setPantry(old=>old.filter(item=>!deleteQueue.includes(item.id)));setDeleteQueue([]);}
    catch(reason){setPantryError(reason instanceof Error?reason.message:"删除库存失败。");}
    finally{setPantryBusy(false);}
  };

  const pantryZone=(location:PantryLocation,title:string,eyebrow:string,placeholder:string)=>{
    const items=pantry.filter(item=>item.storageLocation===location);
    return <section className={`pantry-zone pantry-zone-${location}`}><div className="pantry-zone-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span className="badge">{items.length} 项</span></div><div className="pantry-add-row"><div className="field"><label>加入{title}食材</label><input value={pantryInputs[location]} onChange={event=>setPantryInputs(old=>({...old,[location]:event.target.value}))} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void addPantry(location);}}} placeholder={placeholder}/></div><button className="btn btn-primary" type="button" disabled={pantryBusy||!pantryInputs[location].trim()} onClick={()=>void addPantry(location)}>＋ 加入</button></div>{items.length?<div className="pantry-item-grid">{items.map(item=>{const queued=deleteQueue.includes(item.id);return <article className={`pantry-item ${queued?"is-queued":""}`} key={item.id}><div><b>{item.name}</b><small>{item.category||"其他"}</small></div><button type="button" className="pantry-delete" onClick={()=>toggleDelete(item.id)} aria-pressed={queued} title={queued?`取消删除 ${item.name}`:`将 ${item.name} 加入删除队列`}>×</button>{queued&&<span>待删除</span>}</article>;})}</div>:<div className="pantry-empty">这里还没有食材。</div>}</section>;
  };

  return <div className="page">
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow" style={{color:"#f0c89e"}}>YOUR PERSONAL COOKBOOK</p><h1>今天，想做点<br/>真正成功过的。</h1><p>把 B 站收藏整理成自己的版本，记录每次调整；以后不再重新翻视频找克数和火候。</p><div className="hero-actions"><Link href="/recipes/new" className="btn btn-primary">＋ 新建菜谱</Link><Link href="/imports" className="btn btn-secondary">导入收藏夹</Link></div></div>
      <div className="hero-board"><div className="mini-stat"><strong>{successful}</strong><span>已验证成功</span></div><div className="mini-stat"><strong>{inbox}</strong><span>等待整理</span></div><div className="mini-stat"><strong>{logs.length}</strong><span>制作记录</span></div><div className="mini-stat"><strong>3</strong><span>中英德语言</span></div></div>
    </section>
    <section className="stats"><div className="stat"><div className="stat-label">全部菜谱</div><div className="stat-value">{recipes.length}</div><small>个人知识库</small></div><div className="stat"><div className="stat-label">常做</div><div className="stat-value">{recipes.filter(r=>r.status==="favorite").length}</div><small>随时可复刻</small></div><div className="stat"><div className="stat-label">待尝试</div><div className="stat-value">{recipes.filter(r=>r.status==="to_try").length}</div><small>下一批候选</small></div><div className="stat"><div className="stat-label">我的粮仓</div><div className="stat-value">{pantry.length}</div><small>冰箱 / 储物柜</small></div></section>

    <section className="panel pantry-board" style={{marginTop:20,marginBottom:24}}>
      <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">MY PANTRY</p><h2>我的粮仓</h2><p className="subtitle">把冷藏食材和常温储物分开放置。粮仓中的库存会从采购清单自动排除；需要删除时先加入队列，再统一确认。</p></div><span className="badge">{pantry.length} 项库存</span></div>
      {cloudStatus==="connected"?<>
        <div className="pantry-zones">{pantryZone("fridge","线上冰箱","ONLINE FRIDGE","例如：牛奶、鸡蛋、黄油")}{pantryZone("cabinet","线上储物柜","ONLINE CABINET","例如：盐、花椒、酱油、干货")}</div>
        {pantryError&&<div className="notice" role="alert" style={{marginTop:12,background:"#fbe5de",color:"#923c29"}}>{pantryError}</div>}
        {deleteQueue.length>0&&<div className="pantry-delete-queue" role="status"><div><b>删除队列：{deleteQueue.length} 项</b><small>红色框内的食材将在确认后统一删除。</small></div><button className="btn btn-secondary" type="button" onClick={()=>setDeleteQueue([])}>全部取消</button><button className="btn btn-danger" type="button" disabled={pantryBusy} onClick={()=>void confirmDelete()}>{pantryBusy?"正在删除…":"确认统一删除"}</button></div>}
      </>:<div className="notice">登录后线上冰箱会按账号保存在云端，并在不同设备之间同步。</div>}
      <div style={{marginTop:14}}><Link href="/translations" className="btn btn-secondary">打开采购清单 →</Link></div>
    </section>

    <div className="section-head"><h2>最近更新</h2><Link href="/recipes">查看全部 →</Link></div>
    <div className="recipe-grid">{recipes.slice(0,3).map(recipe=><RecipeCard recipe={recipe} key={recipe.id}/>)}</div>
  </div>;
}
