"use client";

import { useMemo, useState } from "react";
import { MealFinanceNav } from "@/components/MealFinanceNav";

const seedItems=[
  {id:"tomato",raw:"BIO TOMATEN 500G",name:"番茄",category:"蔬菜",price:2.49,checked:true},
  {id:"milk",raw:"H-MILCH 3,5%",name:"牛奶",category:"乳制品",price:1.19,checked:true},
  {id:"bag",raw:"PFAND / TASCHE",name:"购物袋／押金",category:"非食品",price:.25,checked:false},
];

export default function LedgerPage(){
  const [fileName,setFileName]=useState("");
  const [items,setItems]=useState(seedItems);
  const foodTotal=useMemo(()=>items.filter(item=>item.checked).reduce((sum,item)=>sum+item.price,0),[items]);
  const toggle=(id:string)=>setItems(current=>current.map(item=>item.id===id?{...item,checked:!item.checked}:item));
  return <div className="page"><header className="page-head"><div><p className="eyebrow">FOOD LEDGER</p><h1>饮食记账</h1><p className="subtitle">上传小票后只提取食品支出；先核对商品与分类，再写入个人账本和采购历史。</p></div><span className="badge warn">GUI 草图 · OCR 未接入</span></header><MealFinanceNav active="ledger"/>
    <div className="finance-layout"><section className="panel"><div className="section-head"><div><p className="eyebrow">RECEIPT INBOX</p><h2>小票收件箱</h2></div><span className="badge">1 待核对</span></div><label className="receipt-drop"><input type="file" accept="image/*,.pdf" onChange={event=>setFileName(event.target.files?.[0]?.name||"")}/><b>▣</b><span><strong>{fileName||"选择小票照片或 PDF"}</strong><small>{fileName?"文件只在当前界面暂存，尚未上传。":"支持相机照片、截图和扫描件；正式版支持批量。"}</small></span><em>{fileName?"已选择":"浏览文件"}</em></label><div className="receipt-steps"><span className="done">1 上传</span><span className={fileName?"current":""}>2 识别</span><span>3 核对</span><span>4 记账</span></div><button className="btn btn-primary" style={{width:"100%"}} disabled>识别并建立草稿（下一步接 OCR）</button></section>
      <aside className="panel"><div className="section-head"><div><p className="eyebrow">MONTH</p><h2>2026 年 8 月</h2></div><span className="badge">EUR</span></div><div className="ledger-total"><span>饮食支出</span><b>€186.40</b><small>预算 €260 · 剩余 €73.60</small></div><div className="ledger-bar"><span style={{width:"72%"}}/></div><ul className="ledger-categories"><li><span>食材采购</span><b>€142.10</b></li><li><span>外食</span><b>€34.80</b></li><li><span>饮品</span><b>€9.50</b></li></ul></aside>
    </div>
    <section className="panel ledger-review"><div className="section-head"><div><p className="eyebrow">REVIEW DRAFT</p><h2>识别结果核对示例</h2><p className="subtitle">原始文字永远保留；匹配词典后仍由你确认哪些属于饮食支出。</p></div><b className="ledger-food-total">食品 €{foodTotal.toFixed(2)}</b></div><div className="table-wrap"><table><thead><tr><th>计入</th><th>小票原文</th><th>词典匹配</th><th>分类</th><th>金额</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><input type="checkbox" checked={item.checked} onChange={()=>toggle(item.id)} aria-label={`${item.name}计入饮食账本`}/></td><td><code>{item.raw}</code></td><td><b>{item.name}</b></td><td><span className="tag">{item.category}</span></td><td>€{item.price.toFixed(2)}</td></tr>)}</tbody></table></div><div className="source-actions" style={{justifyContent:"flex-end"}}><button className="btn btn-secondary" disabled>保存为待核对</button><button className="btn btn-primary" disabled>确认并记账</button></div></section>
  </div>;
}
