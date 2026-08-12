import type { CartRecipe } from "@/components/ShoppingCartProvider";
import { findKitchenEntry, type PurchaseChannel } from "./kitchen-dictionary";

export type ShoppingLine={
  key:string;
  canonicalName:string;
  displayName:string;
  en:string;
  de:string;
  channel:PurchaseChannel;
  category:string;
  amounts:string[];
  recipes:string[];
  shelfHint:string;
  matched:boolean;
};

function clean(value:string){return value.trim().replace(/\s+/g," ");}

export function buildShoppingList(recipes:CartRecipe[]):ShoppingLine[]{
  const map=new Map<string,ShoppingLine>();
  recipes.forEach(recipe=>recipe.ingredients.forEach(item=>{
    const name=clean(item.name);if(!name)return;
    const entry=findKitchenEntry(name,"ingredient");
    const canonicalName=entry?.zh||name;
    const key=(entry?.id||name.toLowerCase());
    const amount=[clean(item.amount),clean(item.unit)].filter(Boolean).join(" ")||"用量未写";
    const existing=map.get(key);
    if(existing){if(!existing.amounts.includes(amount))existing.amounts.push(amount);if(!existing.recipes.includes(recipe.title))existing.recipes.push(recipe.title);return;}
    map.set(key,{key,canonicalName,displayName:name,en:entry?.en||"待补充",de:entry?.de||"待补充",channel:entry?.channel||"asian_market",category:entry?.category||"待归类",amounts:[amount],recipes:[recipe.title],shelfHint:entry?.shelfHint||"词典暂无记录，请人工确认购买位置。",matched:Boolean(entry)});
  }));
  return [...map.values()].sort((a,b)=>a.channel.localeCompare(b.channel)||a.category.localeCompare(b.category,"zh-CN")||a.canonicalName.localeCompare(b.canonicalName,"zh-CN"));
}

export function shoppingListToText(lines:ShoppingLine[]){
  const groups:[string,PurchaseChannel[]][]=[
    ["德国普通超市",["german_supermarket","both"]],
    ["亚超优先 / 特殊食材",["asian_market"]],
  ];
  const out:string[]=[];
  groups.forEach(([title,channels])=>{
    const items=lines.filter(line=>channels.includes(line.channel));if(!items.length)return;
    out.push(`【${title}】`);items.forEach(line=>out.push(`□ ${line.canonicalName} — ${line.amounts.join(" + ")} (${line.de})`));out.push("");
  });
  return out.join("\n").trim();
}

export function shoppingListToCsv(lines:ShoppingLine[]){
  const esc=(v:string)=>`"${v.replaceAll('"','""')}"`;
  return "\uFEFF"+["中文,English,Deutsch,用量,采购区,来源菜谱",""].slice(0,1).concat(lines.map(line=>[line.canonicalName,line.en,line.de,line.amounts.join(" + "),line.channel,line.recipes.join(" / ")].map(esc).join(","))).join("\r\n");
}
