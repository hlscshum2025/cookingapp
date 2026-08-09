"use client";

import { useMemo, useState } from "react";
import { calculateRecipeCost, type IngredientCostInput } from "@/lib/costing";

const seed: IngredientCostInput[] = [
  { id:"flour",name:"面粉",purchasePrice:1.49,currency:"EUR",packageAmount:1000,packageUnit:"g",allocation:{mode:"quantity",usedAmount:500,usedUnit:"g"} },
  { id:"yeast",name:"酵母",purchasePrice:0.99,currency:"EUR",packageAmount:21,packageUnit:"g",allocation:{mode:"quantity",usedAmount:5,usedUnit:"g"} },
  { id:"seasoning",name:"少量调料",purchasePrice:2.49,currency:"EUR",allocation:{mode:"uses",estimatedUses:50} },
];

function allocationLabel(item: IngredientCostInput) {
  if (item.allocation.mode === "quantity") {
    return `${item.allocation.usedAmount}${item.allocation.usedUnit} / ${item.packageAmount}${item.packageUnit}`;
  }
  if (item.allocation.mode === "uses") return `每 ${item.allocation.estimatedUses} 次均摊`;
  return `固定估价 €${item.allocation.fixedAmount.toFixed(2)}`;
}

export default function CostsPage(){
  const [servings,setServings]=useState(4);
  const [items,setItems]=useState(seed);
  const result=useMemo(()=>{try{return {value:calculateRecipeCost(items,servings),error:""}}catch(error){return {value:null,error:error instanceof Error?error.message:"核算失败"}}},[items,servings]);
  const updatePrice=(id:string,value:number)=>setItems((current)=>current.map((item)=>item.id===id?{...item,purchasePrice:value}:item));
  return <div className="page"><header className="page-head"><div><p className="eyebrow">COSTING SKELETON</p><h1>成本核算试算</h1><p className="subtitle">主食材按包装净量与实际用量计算；难称量调料可按预计使用次数或固定估价均摊。</p></div></header><div className="two-col"><section className="panel"><h2>采购与用量</h2><div className="table-wrap"><table><thead><tr><th>项目</th><th>购买价 EUR</th><th>包装／分摊</th></tr></thead><tbody>{items.map((item)=><tr key={item.id}><td><b>{item.name}</b></td><td><input aria-label={`${item.name}购买价`} type="number" min="0" step="0.01" value={item.purchasePrice} onChange={(event)=>updatePrice(item.id,Number(event.target.value))}/></td><td>{allocationLabel(item)}</td></tr>)}</tbody></table></div></section><aside className="panel"><h2>本次结果</h2><div className="field"><label>份数</label><input type="number" min="1" value={servings} onChange={(event)=>setServings(Number(event.target.value))}/></div>{result.error?<div className="notice" style={{marginTop:16,background:"#fbe5de",color:"#923c29"}}>{result.error}</div>:result.value&&<><div className="stats" style={{gridTemplateColumns:"1fr 1fr",marginTop:16}}><div className="stat"><div className="stat-label">整道菜</div><div className="stat-value">€{result.value.total.toFixed(2)}</div></div><div className="stat"><div className="stat-label">每人份</div><div className="stat-value">€{result.value.perServing.toFixed(2)}</div></div></div>{result.value.estimated&&<div className="notice">包含按次数均摊的估计项；正式做饭时应保存本次成本快照。</div>}</>}</aside></div></div>;
}
