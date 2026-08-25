"use client";

import { useState } from "react";
import { MealFinanceNav } from "@/components/MealFinanceNav";

type TaskStatus="待认领"|"已认领"|"已完成";
type Dish={id:string;name:string;owner:string;task:string;status:TaskStatus;votes:number};

const initialDishes:Dish[]=[
  {id:"braised-pork",name:"红烧肉",owner:"越",task:"主厨",status:"已认领",votes:5},
  {id:"salad",name:"凉拌黄瓜",owner:"待认领",task:"帮厨",status:"待认领",votes:3},
  {id:"rice",name:"米饭与饮料",owner:"Lin",task:"采购",status:"已认领",votes:4},
];

export default function GatheringsPage(){
  const [dishes,setDishes]=useState(initialDishes);
  const [note,setNote]=useState("");
  const claim=(id:string)=>setDishes(current=>current.map(item=>item.id===id?{...item,owner:item.owner==="待认领"?"我":item.owner,status:item.status==="待认领"?"已认领":item.status}:item));
  const toggleVote=(id:string)=>setDishes(current=>current.map(item=>item.id===id?{...item,votes:item.votes+1}:item));
  return <div className="page"><header className="page-head"><div><p className="eyebrow">GROUP MEAL</p><h1>聚餐协作</h1><p className="subtitle">先决定吃什么，再分配主厨、帮厨、采购和付款；小票确认后进入 AA 分账。</p></div><span className="badge warn">GUI 草图 · 不写数据库</span></header><MealFinanceNav active="gatherings"/>
    <section className="gathering-hero panel"><div><span className="gathering-date">周六 · 18:30</span><h2>夏末家常菜聚餐</h2><p className="subtitle">6 人 · 越家厨房 · 距离锁定菜单还有 2 天</p></div><div className="gathering-people" aria-label="参与成员"><span>越</span><span>林</span><span>安</span><span>＋3</span></div><button className="btn btn-primary" disabled>邀请成员（后续）</button></section>
    <div className="finance-layout"><section className="panel"><div className="section-head"><div><p className="eyebrow">MENU & ROLES</p><h2>点菜与分工</h2></div><button className="btn btn-secondary" disabled>＋ 挂一道菜</button></div><div className="dish-task-list">{dishes.map(item=><article key={item.id}><button className="dish-vote" onClick={()=>toggleVote(item.id)} aria-label={`支持 ${item.name}`}><b>♡</b><span>{item.votes}</span></button><div><h3>{item.name}</h3><p>{item.task} · {item.owner}</p></div><span className={`task-status ${item.status==="待认领"?"open":""}`}>{item.status}</span>{item.status==="待认领"&&<button className="btn btn-secondary" onClick={()=>claim(item.id)}>我来帮忙</button>}</article>)}</div><div className="field finance-note"><label>给聚餐成员的说明</label><textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：有人对坚果过敏；采购时保留小票"/></div></section>
      <aside className="panel"><div className="section-head"><div><p className="eyebrow">SHARED BILL</p><h2>AA 预览</h2></div><span className="badge">待小票</span></div><div className="bill-summary"><div><span>预计采购</span><b>€42.60</b></div><div><span>已有垫付</span><b>€12.00</b></div><div className="bill-total"><span>预计每人</span><b>€7.10</b></div></div><div className="notice">正式版本会把采购前预算、购买后小票、个人不参与项目和付款状态分开；识别结果必须先核对再分账。</div><button className="btn btn-primary" style={{width:"100%",marginTop:14}} disabled>锁定菜单并生成任务</button></aside>
    </div></div>;
}
