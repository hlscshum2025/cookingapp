"use client";

import { useState } from "react";
import {
  groupIngredientTranslations,
  purchaseChannelLabels,
  type PurchaseChannel,
} from "@/lib/ingredient-sourcing";

export default function TranslationsPage() {
  const [channel, setChannel] = useState<PurchaseChannel>("german_supermarket");
  const groups = groupIngredientTranslations();
  const items = channel === "german_supermarket" ? groups.germanSupermarket : groups.asianMarket;
  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">TRANSLATION & SOURCING</p><h1>翻译与采购分区</h1><p className="subtitle">普通超市食材提供更细的德语名称解释；中式调料单独标记亚超购买和品牌核验。</p></div></header>
    <div className="search-panel">{(["german_supermarket","asian_market"] as PurchaseChannel[]).map((key)=><button key={key} className={`btn ${channel===key?"btn-primary":"btn-secondary"}`} onClick={()=>setChannel(key)}>{purchaseChannelLabels[key]}</button>)}</div>
    <div className="table-wrap"><table><thead><tr><th>中文</th><th>English</th><th>Deutsch</th><th>购买位置</th><th>需要详细核验</th></tr></thead><tbody>{items.map((item)=><tr key={item.id}><td><b>{item.zh}</b><br/><small>{item.category}</small></td><td>{item.en}</td><td>{item.de}</td><td>{item.shelfHint}</td><td>{item.detailNote}<br/><span className={`badge ${item.verified?"":"warn"}`}>{item.verified?"已确认":"待实地确认"}</span></td></tr>)}</tbody></table></div>
    <div className="notice" style={{marginTop:16}}>示例把你提到的 Filet 和 Dattel 也作为“需要详细解释”的普通食材。过敏原与无麸质结论仍以具体包装为准。</div>
  </div>;
}

