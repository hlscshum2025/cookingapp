"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateRecipeCost, type IngredientCostInput } from "@/lib/costing";
import { MealFinanceNav, type MealFinanceModule } from "@/components/MealFinanceNav";
import { loadPublicRecipes, togglePublicRecipeLike } from "@/lib/public-recipes";
import { createLedgerEntry, deleteLedgerEntry, loadLedgerEntries, type LedgerEntry } from "@/lib/supabase";

const costSeed:IngredientCostInput[]=[
  {id:"flour",name:"面粉",purchasePrice:1.49,currency:"EUR",packageAmount:1000,packageUnit:"g",allocation:{mode:"quantity",usedAmount:500,usedUnit:"g"}},
  {id:"yeast",name:"酵母",purchasePrice:.99,currency:"EUR",packageAmount:21,packageUnit:"g",allocation:{mode:"quantity",usedAmount:5,usedUnit:"g"}},
  {id:"seasoning",name:"少量调料",purchasePrice:2.49,currency:"EUR",allocation:{mode:"uses",estimatedUses:50}},
];

type RoleKey="helper"|"buyer";
type Dish={id:string;name:string;chef:string;votes:number;likedByMe:boolean;likeBusy:boolean;claims:Record<RoleKey,boolean>};

const pageMeta:Record<MealFinanceModule,{eyebrow:string;title:string;subtitle:string;badge:string;warn?:boolean}>={
  costs:{eyebrow:"FOOD FINANCE",title:"成本核算",subtitle:"这里负责“这道菜花多少钱”；聚餐分工和个人记账使用独立流程，但后续共享小票与采购数据。",badge:"可交互试算"},
  gatherings:{eyebrow:"GROUP MEAL",title:"聚餐协作",subtitle:"先决定吃什么，再分配主厨、帮厨、采购和付款；小票确认后进入 AA 分账。",badge:"GUI 草图 · 不写数据库",warn:true},
  ledger:{eyebrow:"FOOD LEDGER",title:"饮食记账",subtitle:"手动记录每笔餐饮支出与分摊人数；账目按账号保存。",badge:"可直接记账"},
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
  const [ledgerEntries,setLedgerEntries]=useState<LedgerEntry[]>([]);
  const [ledgerLoading,setLedgerLoading]=useState(initialActive==="ledger");
  const [ledgerSaving,setLedgerSaving]=useState(false);
  const [ledgerError,setLedgerError]=useState("");
  const [ledgerNotice,setLedgerNotice]=useState("");
  const [description,setDescription]=useState("");
  const [amount,setAmount]=useState("");
  const [peopleCount,setPeopleCount]=useState("1");
  const [happenedOn,setHappenedOn]=useState(()=>new Date().toISOString().slice(0,10));
  const [ledgerNote,setLedgerNote]=useState("");
  const costResult=useMemo(()=>{try{return{value:calculateRecipeCost(costItems,servings),error:""}}catch(error){return{value:null,error:error instanceof Error?error.message:"核算失败"}}},[costItems,servings]);
  const monthPrefix=new Date().toISOString().slice(0,7);
  const monthlyLedgerTotal=useMemo(()=>ledgerEntries.filter(entry=>entry.happened_on.startsWith(monthPrefix)).reduce((sum,entry)=>sum+Number(entry.amount),0),[ledgerEntries,monthPrefix]);
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

  useEffect(()=>{
    if(active!=="ledger")return;
    let mounted=true;
    loadLedgerEntries().then(entries=>{if(mounted)setLedgerEntries(entries);})
      .catch(error=>{if(mounted)setLedgerError(error instanceof Error?error.message:"账目加载失败，请重试。");})
      .finally(()=>{if(mounted)setLedgerLoading(false);});
    return()=>{mounted=false;};
  },[active]);

  const selectModule=(module:MealFinanceModule)=>{
    if(module==="ledger"&&active!=="ledger"){setLedgerLoading(true);setLedgerError("");}
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
  const saveLedgerEntry=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setLedgerError("");setLedgerNotice("");
    const numericAmount=Number(amount),numericPeople=Number(peopleCount);
    if(!description.trim()){setLedgerError("请填写账目名称。");return;}
    if(!Number.isFinite(numericAmount)||numericAmount<=0){setLedgerError("金额必须大于 0。");return;}
    if(!Number.isInteger(numericPeople)||numericPeople<1){setLedgerError("人数至少为 1，且必须是整数。");return;}
    setLedgerSaving(true);
    try{
      const entry=await createLedgerEntry({description,amount:Math.round(numericAmount*100)/100,peopleCount:numericPeople,happenedOn,note:ledgerNote});
      setLedgerEntries(current=>[entry,...current]);setDescription("");setAmount("");setPeopleCount("1");setLedgerNote("");
      setLedgerNotice("账目已保存。");
    }catch(error){setLedgerError(error instanceof Error?error.message:"保存失败，请稍后重试。");}
    finally{setLedgerSaving(false);}
  };
  const removeLedgerEntry=async(entry:LedgerEntry)=>{
    if(!window.confirm(`确定删除“${entry.description} · ${entry.currency} ${Number(entry.amount).toFixed(2)}”吗？`))return;
    setLedgerError("");
    try{await deleteLedgerEntry(entry.id);setLedgerEntries(current=>current.filter(item=>item.id!==entry.id));setLedgerNotice("账目已删除。");}
    catch(error){setLedgerError(error instanceof Error?error.message:"删除失败，请稍后重试。");}
  };

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><p className="subtitle">{meta.subtitle}</p></div><span className={`badge ${meta.warn?"warn":""}`}>{meta.badge}</span></header>
    <div className="meal-finance-switcher"><MealFinanceNav active={active} onSelect={selectModule}/></div>
    <div className="meal-finance-view" aria-live="polite">
      {active==="costs"&&<CostsView items={costItems} servings={servings} result={costResult} setServings={setServings} updatePrice={updatePrice}/>}
      {active==="gatherings"&&<GatheringsView dishes={dishes} dishLoadState={dishLoadState} openDishId={openDishId} note={note} setNote={setNote} setOpenDishId={setOpenDishId} toggleVote={toggleVote} toggleClaim={toggleClaim}/>}
      {active==="ledger"&&<LedgerView entries={ledgerEntries} loading={ledgerLoading} saving={ledgerSaving} error={ledgerError} notice={ledgerNotice} description={description} amount={amount} peopleCount={peopleCount} happenedOn={happenedOn} note={ledgerNote} monthlyTotal={monthlyLedgerTotal} onDescription={setDescription} onAmount={setAmount} onPeopleCount={setPeopleCount} onHappenedOn={setHappenedOn} onNote={setLedgerNote} onSubmit={saveLedgerEntry} onRemove={removeLedgerEntry}/>}
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

function LedgerView(props:{entries:LedgerEntry[];loading:boolean;saving:boolean;error:string;notice:string;description:string;amount:string;peopleCount:string;happenedOn:string;note:string;monthlyTotal:number;onDescription:(v:string)=>void;onAmount:(v:string)=>void;onPeopleCount:(v:string)=>void;onHappenedOn:(v:string)=>void;onNote:(v:string)=>void;onSubmit:(event:React.FormEvent<HTMLFormElement>)=>void;onRemove:(entry:LedgerEntry)=>void}){
  const currency=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"});
  return <div className="finance-layout"><section className="panel"><div className="section-head"><div><p className="eyebrow">MANUAL EXPENSE</p><h2>记录一笔支出</h2><p className="subtitle">填写总额和参与人数，自动计算人均金额。每条记录仅当前账号可见。</p></div><span className="badge">EUR</span></div>
    <form className="form-grid" onSubmit={props.onSubmit}><div className="field full"><label htmlFor="ledger-description">账目名称</label><input id="ledger-description" required maxLength={160} value={props.description} onChange={e=>props.onDescription(e.target.value)} placeholder="例如：周末采购 / 外出聚餐"/></div><div className="field"><label htmlFor="ledger-amount">总金额（EUR）</label><input id="ledger-amount" type="number" min="0.01" step="0.01" required value={props.amount} onChange={e=>props.onAmount(e.target.value)} placeholder="0.00"/></div><div className="field"><label htmlFor="ledger-people">分摊人数</label><input id="ledger-people" type="number" min="1" max="1000" step="1" required value={props.peopleCount} onChange={e=>props.onPeopleCount(e.target.value)}/></div><div className="field"><label htmlFor="ledger-date">日期</label><input id="ledger-date" type="date" required value={props.happenedOn} onChange={e=>props.onHappenedOn(e.target.value)}/></div><div className="field full"><label htmlFor="ledger-note">备注（可选）</label><textarea id="ledger-note" maxLength={2000} value={props.note} onChange={e=>props.onNote(e.target.value)} placeholder="补充说明"/></div><div className="source-actions compact-actions full"><button className="btn btn-primary" type="submit" disabled={props.saving}>{props.saving?"正在保存…":"保存账目"}</button><small>输入金额和人数后会显示每人分摊金额。</small></div></form>
    {props.error&&<div className="notice notice-error" role="alert">{props.error}</div>}{props.notice&&<div className="notice" role="status">{props.notice}</div>}
  </section><aside className="panel"><div className="section-head"><div><p className="eyebrow">THIS MONTH</p><h2>本月汇总</h2></div><span className="badge">EUR</span></div><div className="ledger-total"><span>饮食支出</span><b>{currency.format(props.monthlyTotal)}</b><small>根据本月手动记录自动汇总</small></div><div className="notice">新账目默认只对当前账号可见。分摊金额仅用于参考，不会自动向其他成员收费。</div></aside>
    <section className="panel ledger-review"><div className="section-head"><div><p className="eyebrow">RECENT ENTRIES</p><h2>账目记录</h2></div><span className="badge">{props.entries.length} 笔</span></div>{props.loading?<div className="notice">正在读取账目…</div>:props.entries.length?<div className="table-wrap"><table><thead><tr><th>日期与项目</th><th>总金额</th><th>人数</th><th>人均</th><th>备注</th><th>操作</th></tr></thead><tbody>{props.entries.map(entry=><tr key={entry.id}><td><b>{entry.description}</b><br/><small>{entry.happened_on}</small></td><td>{currency.format(Number(entry.amount))}</td><td>{entry.people_count}</td><td>{currency.format(Number(entry.amount)/entry.people_count)}</td><td>{entry.note||"—"}</td><td><button type="button" className="btn btn-secondary" onClick={()=>props.onRemove(entry)}>删除</button></td></tr>)}</tbody></table></div>:<div className="empty"><span>▤</span><h2>还没有账目</h2><p>先在上方录入今晚的支出。</p></div>}</section>
  </div>;
}
