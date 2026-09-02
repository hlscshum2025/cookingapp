"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculateRecipeCost, type IngredientCostInput } from "@/lib/costing";
import { MealFinanceNav, type MealFinanceModule } from "@/components/MealFinanceNav";
import { loadPublicRecipes, togglePublicRecipeLike } from "@/lib/public-recipes";

const costSeed:IngredientCostInput[]=[
  {id:"flour",name:"面粉",purchasePrice:1.49,currency:"EUR",packageAmount:1000,packageUnit:"g",allocation:{mode:"quantity",usedAmount:500,usedUnit:"g"}},
  {id:"yeast",name:"酵母",purchasePrice:.99,currency:"EUR",packageAmount:21,packageUnit:"g",allocation:{mode:"quantity",usedAmount:5,usedUnit:"g"}},
  {id:"seasoning",name:"少量调料",purchasePrice:2.49,currency:"EUR",allocation:{mode:"uses",estimatedUses:50}},
];

const ledgerSeed=[
  {id:"tomato",raw:"BIO TOMATEN 500G",name:"番茄",category:"蔬菜",price:2.49,checked:true},
  {id:"milk",raw:"H-MILCH 3,5%",name:"牛奶",category:"乳制品",price:1.19,checked:true},
  {id:"bag",raw:"PFAND / TASCHE",name:"购物袋／押金",category:"非食品",price:.25,checked:false},
];

type RoleKey="helper"|"buyer";
type Dish={id:string;name:string;chef:string;votes:number;likedByMe:boolean;likeBusy:boolean;claims:Record<RoleKey,boolean>};

const pageMeta:Record<MealFinanceModule,{eyebrow:string;title:string;subtitle:string;badge:string;warn?:boolean}>={
  costs:{eyebrow:"FOOD FINANCE",title:"成本核算",subtitle:"这里负责“这道菜花多少钱”；聚餐分工和个人记账使用独立流程，但后续共享小票与采购数据。",badge:"可交互试算"},
  gatherings:{eyebrow:"GROUP MEAL",title:"聚餐协作",subtitle:"先决定吃什么，再分配主厨、帮厨、采购和付款；小票确认后进入 AA 分账。",badge:"GUI 草图 · 不写数据库",warn:true},
  ledger:{eyebrow:"FOOD LEDGER",title:"饮食记账",subtitle:"上传小票后只提取食品支出；先核对商品与分类，再写入个人账本和采购历史。",badge:"OCR 可联调",warn:true},
};

function allocationLabel(item:IngredientCostInput){
  if(item.allocation.mode==="quantity")return `${item.allocation.usedAmount}${item.allocation.usedUnit} / ${item.packageAmount}${item.packageUnit}`;
  if(item.allocation.mode==="uses")return `每 ${item.allocation.estimatedUses} 次均摊`;
  return `固定估价 €${item.allocation.fixedAmount.toFixed(2)}`;
}

export function MealFinanceWorkspace({initialActive}:{initialActive:MealFinanceModule}){
  const [active,setActive]=useState(initialActive);
  const [servings,setServings]=useState(4);
  const [costItems,setCostItems]=useState(costSeed);
  const [dishes,setDishes]=useState<Dish[]>([]);
  const [dishLoadState,setDishLoadState]=useState<"loading"|"ready"|"error">("loading");
  const [openDishId,setOpenDishId]=useState<string|null>(null);
  const [note,setNote]=useState("");
  const [fileName,setFileName]=useState("");
  const [ledgerItems,setLedgerItems]=useState(ledgerSeed);
  const costResult=useMemo(()=>{try{return{value:calculateRecipeCost(costItems,servings),error:""}}catch(error){return{value:null,error:error instanceof Error?error.message:"核算失败"}}},[costItems,servings]);
  const foodTotal=useMemo(()=>ledgerItems.filter(item=>item.checked).reduce((sum,item)=>sum+item.price,0),[ledgerItems]);
  const meta=pageMeta[active];

  useEffect(()=>{
    let activeRequest=true;
    loadPublicRecipes().then(recipes=>{
      if(!activeRequest)return;
      setDishes(recipes.slice(0,8).map(item=>({
        id:item.recipeId,
        name:item.recipe.title,
        chef:"公开菜谱库",
        votes:item.likeCount,
        likedByMe:item.likedByMe,
        likeBusy:false,
        claims:{helper:false,buyer:false},
      })));
      setDishLoadState("ready");
    }).catch(()=>{if(activeRequest)setDishLoadState("error");});
    return()=>{activeRequest=false;};
  },[]);

  const selectModule=(module:MealFinanceModule)=>{
    setActive(module);
    window.history.replaceState(window.history.state,"",`/${module}`);
  };
  const updatePrice=(id:string,value:number)=>setCostItems(current=>current.map(item=>item.id===id?{...item,purchasePrice:value}:item));
  const toggleVote=async(id:string)=>{
    const dish=dishes.find(item=>item.id===id);
    if(!dish||dish.likeBusy)return;
    setDishes(current=>current.map(item=>item.id===id?{...item,likeBusy:true}:item));
    try{
      const liked=await togglePublicRecipeLike(id,dish.likedByMe);
      setDishes(current=>current.map(item=>item.id===id?{...item,likedByMe:liked,likeBusy:false,votes:Math.max(0,item.votes+(liked?1:-1))}:item));
    }catch{
      setDishes(current=>current.map(item=>item.id===id?{...item,likeBusy:false}:item));
    }
  };
  const toggleClaim=(id:string,role:RoleKey)=>setDishes(current=>current.map(item=>item.id===id?{...item,claims:{...item.claims,[role]:!item.claims[role]}}:item));
  const toggleLedgerItem=(id:string)=>setLedgerItems(current=>current.map(item=>item.id===id?{...item,checked:!item.checked}:item));

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><p className="subtitle">{meta.subtitle}</p></div><span className={`badge ${meta.warn?"warn":""}`}>{meta.badge}</span></header>
    <div className="meal-finance-switcher"><MealFinanceNav active={active} onSelect={selectModule}/></div>
    <div className="meal-finance-view" aria-live="polite">
      {active==="costs"&&<CostsView items={costItems} servings={servings} result={costResult} setServings={setServings} updatePrice={updatePrice}/>}
      {active==="gatherings"&&<GatheringsView dishes={dishes} dishLoadState={dishLoadState} openDishId={openDishId} note={note} setNote={setNote} setOpenDishId={setOpenDishId} toggleVote={toggleVote} toggleClaim={toggleClaim}/>}
      {active==="ledger"&&<LedgerView fileName={fileName} items={ledgerItems} foodTotal={foodTotal} setFileName={setFileName} toggleItem={toggleLedgerItem}/>}
    </div>
  </div>;
}

function CostsView({items,servings,result,setServings,updatePrice}:{items:IngredientCostInput[];servings:number;result:{value:ReturnType<typeof calculateRecipeCost>|null;error:string};setServings:(value:number)=>void;updatePrice:(id:string,value:number)=>void}){
  return <div className="two-col"><section className="panel"><div className="section-head"><div><h2>采购与用量</h2><p className="subtitle">主食材按包装净量与实际用量计算。</p></div><span className="badge">EUR</span></div><div className="table-wrap"><table><thead><tr><th>项目</th><th>购买价 EUR</th><th>包装／分摊</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><b>{item.name}</b></td><td><input aria-label={`${item.name}购买价`} type="number" min="0" step="0.01" value={item.purchasePrice} onChange={event=>updatePrice(item.id,Number(event.target.value))}/></td><td>{allocationLabel(item)}</td></tr>)}</tbody></table></div></section><aside className="panel"><h2>本次结果</h2><div className="field"><label>份数</label><input type="number" min="1" value={servings} onChange={event=>setServings(Number(event.target.value))}/></div>{result.error?<div className="notice finance-error">{result.error}</div>:result.value&&<><div className="stats finance-stats"><div className="stat"><div className="stat-label">整道菜</div><div className="stat-value">€{result.value.total.toFixed(2)}</div></div><div className="stat"><div className="stat-label">每人份</div><div className="stat-value">€{result.value.perServing.toFixed(2)}</div></div></div>{result.value.estimated&&<div className="notice">包含按次数均摊的估计项；正式功能会保存本次成本快照。</div>}</>}</aside></div>;
}

function GatheringsView({dishes,dishLoadState,openDishId,note,setNote,setOpenDishId,toggleVote,toggleClaim}:{dishes:Dish[];dishLoadState:"loading"|"ready"|"error";openDishId:string|null;note:string;setNote:(value:string)=>void;setOpenDishId:(value:string|null)=>void;toggleVote:(id:string)=>Promise<void>;toggleClaim:(id:string,role:RoleKey)=>void}){
  const roles:[RoleKey,string,string][]=[["helper","帮厨","备菜、清洁和协助出锅"],["buyer","采购","购买食材并保留小票"]];
  return <><section className="gathering-hero panel"><div><span className="gathering-date">周六 · 18:30</span><h2>夏末家常菜聚餐</h2><p className="subtitle">6 人 · 越家厨房 · 距离锁定菜单还有 2 天</p></div><div><small className="demo-label">演示成员</small><div className="gathering-people" aria-label="演示参与成员"><span>越</span><span>林</span><span>安</span><span>＋3</span></div></div><button className="btn btn-primary" disabled>邀请成员（后续）</button></section>
    <div className="finance-layout"><section className="panel"><div className="section-head"><div><p className="eyebrow">MENU & ROLES</p><h2>点菜与分工</h2><p className="subtitle">菜品与爱心次数直接来自公开菜谱库；同一账号对每道菜最多点一次。</p></div><button className="btn btn-secondary" disabled>＋ 挂一道菜</button></div>{dishLoadState==="loading"&&<div className="notice">正在读取公开菜谱库…</div>}{dishLoadState==="error"&&<div className="notice notice-error">公开菜谱暂时无法读取，请稍后重试。</div>}{dishLoadState==="ready"&&dishes.length===0&&<div className="notice">公开菜谱库还没有可供聚餐点选的菜谱。</div>}<div className="dish-task-list">{dishes.map(item=>{const open=openDishId===item.id;return <article key={item.id} className={open?"is-open":""}><div className="dish-summary"><button type="button" className="dish-vote" disabled={item.likeBusy} aria-pressed={item.likedByMe} onClick={()=>void toggleVote(item.id)} aria-label={`${item.likedByMe?"取消支持":"支持"} ${item.name}`}><b>{item.likedByMe?"♥":"♡"}</b><span>{item.votes}</span></button><button className="dish-expand" type="button" aria-expanded={open} onClick={()=>setOpenDishId(open?null:item.id)}><span><h3>{item.name}</h3><small>来源：{item.chef}</small></span><b aria-hidden="true">{open?"收起 −":"分工 ＋"}</b></button></div>{open&&<div className="dish-role-list">{roles.map(([role,label,description])=>{const claimed=item.claims[role];return <div className="dish-role" key={role}><div><b>{label}</b><small>{description}</small></div><span className={`task-status ${claimed?"":"open"}`}>{claimed?"已认领 · 我":"待认领"}</span><button type="button" className={`btn ${claimed?"btn-danger claim-cancel":"btn-secondary"}`} onClick={()=>toggleClaim(item.id,role)}>{claimed?"我有点忙":"我来帮忙"}</button></div>})}</div>}</article>})}</div><div className="field finance-note"><label>给聚餐成员的说明</label><textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：有人对坚果过敏；采购时保留小票"/></div></section>
      <aside className="panel"><div className="section-head"><div><p className="eyebrow">SHARED BILL</p><h2>AA 预览</h2></div><span className="badge">待小票</span></div><div className="bill-summary"><div><span>预计采购</span><b>€42.60</b></div><div><span>已有垫付</span><b>€12.00</b></div><div className="bill-total"><span>预计每人</span><b>€7.10</b></div></div><div className="notice">正式版本会把采购前预算、购买后小票、个人不参与项目和付款状态分开；识别结果必须先核对再分账。</div><button className="btn btn-primary full-width-action" disabled>锁定菜单并生成任务</button></aside>
    </div></>;
}

function LedgerView({fileName,items,foodTotal,setFileName,toggleItem}:{fileName:string;items:typeof ledgerSeed;foodTotal:number;setFileName:(value:string)=>void;toggleItem:(id:string)=>void}){
  return <><div className="finance-layout"><section className="panel"><div className="section-head"><div><p className="eyebrow">RECEIPT INBOX</p><h2>小票收件箱</h2></div><span className="badge">OCR 联调</span></div><label className="receipt-drop"><input type="file" accept="image/*,.pdf" onChange={event=>setFileName(event.target.files?.[0]?.name||"")}/><b>▣</b><span><strong>{fileName||"选择小票照片或 PDF"}</strong><small>{fileName?"这里仅预览文件名；请进入OCR页面上传。":"长小票可以按从上到下的顺序上传多张照片。"}</small></span><em>{fileName?"已选择":"浏览文件"}</em></label><div className="receipt-steps"><span className="done">1 上传</span><span className={fileName?"current":""}>2 识别</span><span>3 核对</span><span>4 记账</span></div><Link className="btn btn-primary full-width-action" href="/imports/ocr">上传小票并建立草稿 →</Link></section>
    <aside className="panel"><div className="section-head"><div><p className="eyebrow">MONTH</p><h2>2026 年 8 月</h2></div><span className="badge">EUR</span></div><div className="ledger-total"><span>饮食支出</span><b>€186.40</b><small>预算 €260 · 剩余 €73.60</small></div><div className="ledger-bar"><span style={{width:"72%"}}/></div><ul className="ledger-categories"><li><span>食材采购</span><b>€142.10</b></li><li><span>外食</span><b>€34.80</b></li><li><span>饮品</span><b>€9.50</b></li></ul></aside></div>
    <section className="panel ledger-review"><div className="section-head"><div><p className="eyebrow">REVIEW DRAFT</p><h2>识别结果核对示例</h2><p className="subtitle">原始文字永远保留；匹配词典后仍由你确认哪些属于饮食支出。</p></div><b className="ledger-food-total">食品 €{foodTotal.toFixed(2)}</b></div><div className="table-wrap"><table><thead><tr><th>计入</th><th>小票原文</th><th>词典匹配</th><th>分类</th><th>金额</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><input type="checkbox" checked={item.checked} onChange={()=>toggleItem(item.id)} aria-label={`${item.name}计入饮食账本`}/></td><td><code>{item.raw}</code></td><td><b>{item.name}</b></td><td><span className="tag">{item.category}</span></td><td>€{item.price.toFixed(2)}</td></tr>)}</tbody></table></div><div className="source-actions ledger-actions"><button className="btn btn-secondary" disabled>保存为待核对</button><button className="btn btn-primary" disabled>确认并记账</button></div></section></>;
}
