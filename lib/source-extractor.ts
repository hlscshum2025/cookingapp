import type { ExtractedRecipeContent } from "./types";

export type SourceExtractionPlatform="xiachufang"|"xiaohongshu";

export type SourceExtractionResult={
  canonicalUrl:string;
  title:string;
  uploaderName:string;
  description:string;
  coverUrl:string;
  extractedRecipe?:ExtractedRecipeContent;
  extractionMethod:"json_ld"|"page_text"|"meta";
};

type UnknownRecord=Record<string,unknown>;

function asRecord(value:unknown):UnknownRecord|null{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:null;
}

function decodeHtml(value:string){
  return value
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16)));
}

function plainText(value:string){
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(?:p|div|li|tr|h1|h2|h3|section|article)>/gi,"\n")
    .replace(/<[^>]+>/g," ")
    .replace(/\r/g,"")
    .replace(/[ \t]+/g," ")
    .replace(/\n[ \t]+/g,"\n")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function attribute(tag:string,name:string){
  const match=tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`,"i"));
  return decodeHtml((match?.[1]||match?.[2]||"").trim());
}

function metaContent(html:string,keys:string[]){
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    const key=(attribute(tag,"property")||attribute(tag,"name")||attribute(tag,"itemprop")).toLowerCase();
    if(keys.some(candidate=>key===candidate.toLowerCase())){
      const content=attribute(tag,"content");
      if(content)return plainText(content);
    }
  }
  return "";
}

function canonicalUrl(html:string,fallback:string){
  for(const tag of html.match(/<link\b[^>]*>/gi)||[]){
    if(attribute(tag,"rel").toLowerCase()==="canonical"){
      const href=attribute(tag,"href");
      if(href){
        try{return new URL(href,fallback).toString();}catch{}
      }
    }
  }
  return fallback;
}

function scriptJsonLd(html:string){
  const values:unknown[]=[];
  const pattern=/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for(const match of html.matchAll(pattern)){
    const text=decodeHtml(match[1]).trim();
    if(!text)continue;
    try{values.push(JSON.parse(text));}catch{}
  }
  return values;
}

function findRecipe(value:unknown):UnknownRecord|null{
  if(Array.isArray(value)){
    for(const item of value){const found=findRecipe(item);if(found)return found;}
    return null;
  }
  const record=asRecord(value);
  if(!record)return null;
  const rawType=record["@type"];
  const types=Array.isArray(rawType)?rawType:[rawType];
  if(types.some(item=>typeof item==="string"&&item.toLowerCase()==="recipe"))return record;
  for(const child of Object.values(record)){const found=findRecipe(child);if(found)return found;}
  return null;
}

const amountToken=String.raw`(?:\d+(?:\.\d+)?(?:\s*(?:-|~|–|—|至|到|/)\s*\d+(?:\.\d+)?)?|[一二三四五六七八九十半两几]+|适量|少许)`;
const unitToken=String.raw`(?:kg|g|mg|ml|mL|L|克|千克|公斤|毫克|毫升|升|勺|大勺|小勺|汤匙|茶匙|匙|圈|瓶盖|杯|碗|个|颗|枚|只|根|瓣|片|段|块|条|把|撮|包|袋|罐|瓶)`;

export function parseIngredientText(input:string){
  const line=plainText(input).replace(/^[•·\-–—]\s*/,"").trim();
  if(!line)return {name:"",amount:"",unit:""};
  const beginning=line.match(new RegExp(`^(${amountToken})\\s*(${unitToken})?\\s+(.+)$`,"i"));
  if(beginning)return {name:beginning[3].trim(),amount:beginning[1].trim(),unit:(beginning[2]||"").trim()};
  const ending=line.match(new RegExp(`^(.+?)\\s+(${amountToken})\\s*(${unitToken})?$`,"i"));
  if(ending)return {name:ending[1].trim(),amount:ending[2].trim(),unit:(ending[3]||"").trim()};
  return {name:line,amount:"",unit:""};
}

function instructionText(value:unknown):string[]{
  if(typeof value==="string"){const text=plainText(value);return text?[text]:[];}
  if(Array.isArray(value))return value.flatMap(instructionText);
  const record=asRecord(value);if(!record)return [];
  const textValue=record.text??record.description??record.name;
  if(typeof textValue==="string"){const text=plainText(textValue);return text?[text]:[];}
  return Object.values(record).flatMap(instructionText);
}

function recipeFromJsonLd(record:UnknownRecord):ExtractedRecipeContent{
  const ingredientSource=Array.isArray(record.recipeIngredient)?record.recipeIngredient:Array.isArray(record.ingredients)?record.ingredients:[];
  const ingredients=ingredientSource.filter((item):item is string=>typeof item==="string").map(parseIngredientText).filter(item=>item.name);
  const steps=instructionText(record.recipeInstructions).filter(Boolean);
  const summary=typeof record.description==="string"?plainText(record.description):"";
  return {summary:summary||undefined,ingredients,steps,extractionMethod:"json_ld"};
}

function htmlToLines(html:string){
  const reduced=html.replace(/<script\b(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ");
  return plainText(reduced).split("\n").map(line=>line.trim()).filter(Boolean);
}

function looksAmountOnly(line:string){return new RegExp(`^${amountToken}\\s*${unitToken}?$`,"i").test(line.trim());}

function xiachufangFallback(html:string):ExtractedRecipeContent|undefined{
  const lines=htmlToLines(html);
  const ingredientStart=lines.findIndex(line=>/^用料\b/.test(line));
  const methodStart=lines.findIndex((line,index)=>index>Math.max(ingredientStart,0)&&(/做法步骤/.test(line)||(/的做法/.test(line)&&line.length<120)));
  const ingredients:Array<{name:string;amount:string;unit:string}>=[];
  if(ingredientStart>=0&&methodStart>ingredientStart){
    const section=lines.slice(ingredientStart+1,methodStart).filter(line=>line.length<=160);
    for(let index=0;index<section.length&&ingredients.length<80;index++){
      const line=section[index];
      if(/^(收藏|作者|上传|用料)$/.test(line))continue;
      if(index+1<section.length&&!looksAmountOnly(line)&&looksAmountOnly(section[index+1])){
        const parsed=parseIngredientText(`${line} ${section[index+1]}`);if(parsed.name)ingredients.push(parsed);index++;continue;
      }
      const parsed=parseIngredientText(line);
      if(parsed.name&&(!/^\d+\s*人做过/.test(parsed.name)))ingredients.push(parsed);
    }
  }
  const steps:string[]=[];
  if(methodStart>=0){
    const end=lines.findIndex((line,index)=>index>methodStart&&/^(小贴士|该菜谱发布于|菜谱创建时间|参照这个菜谱)/.test(line));
    const section=lines.slice(methodStart+1,end>methodStart?end:Math.min(lines.length,methodStart+120));
    for(let index=0;index<section.length&&steps.length<60;index++){
      const marker=section[index].match(/^步骤\s*(\d+)\s*$/);
      if(marker){const next=section[index+1];if(next&&next.length>2&&!/^步骤\s*\d+/.test(next)){steps.push(next);index++;}continue;}
      const numbered=section[index].match(/^\d+[.、]\s*(.+)$/);if(numbered?.[1])steps.push(numbered[1].trim());
    }
  }
  if(!ingredients.length&&!steps.length)return undefined;
  return {ingredients,steps,extractionMethod:"page_text"};
}

function embeddedJsonString(html:string,keys:string[]){
  for(const key of keys){
    const match=html.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,"i"));
    if(!match?.[1])continue;
    try{return plainText(JSON.parse(`"${match[1]}"`));}catch{}
  }
  return "";
}

export function extractRecipeFromNoteText(text:string):ExtractedRecipeContent|undefined{
  const normalized=text.replace(/(?:^|\s)(配料|用料|食材|材料)\s*[:：]/g,"\n用料\n").replace(/(?:^|\s)(做法|步骤|制作步骤)\s*[:：]/g,"\n做法\n");
  const lines=normalized.split(/\r?\n|；|;/).map(line=>line.trim()).filter(Boolean);
  const ingredientStart=lines.findIndex(line=>line==="用料");
  let methodStart=lines.findIndex((line,index)=>index>ingredientStart&&line==="做法");
  if(methodStart<0&&ingredientStart>=0)methodStart=lines.findIndex((line,index)=>index>ingredientStart&&/^1[.、\s]/.test(line));
  if(ingredientStart<0||methodStart<=ingredientStart)return undefined;
  const ingredients=lines.slice(ingredientStart+1,methodStart).flatMap(line=>line.split(/，|,(?=\S)/)).map(parseIngredientText).filter(item=>item.name).slice(0,80);
  const steps=lines.slice(methodStart).flatMap(line=>line.split(/(?=\d+[.、])/)).map(line=>line.replace(/^做法$/," ").replace(/^\d+[.、]\s*/,"").trim()).filter(line=>line.length>2).slice(0,60);
  if(!ingredients.length&&!steps.length)return undefined;
  return {ingredients,steps,extractionMethod:"page_text"};
}

function safeTitle(value:string,platform:SourceExtractionPlatform){
  return plainText(value).replace(/[_-]?下厨房$/i,"").replace(/\s*[|｜]\s*小红书.*$/i,"").replace(/\s*-\s*小红书.*$/i,"").trim()||`${platform==="xiachufang"?"下厨房":"小红书"}待整理来源`;
}

export function extractSourcePage(html:string,url:string,platform:SourceExtractionPlatform):SourceExtractionResult{
  const finalUrl=canonicalUrl(html,url);
  const title=safeTitle(metaContent(html,["og:title","twitter:title"])||plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||""),platform);
  const description=metaContent(html,["og:description","description","twitter:description"])||(platform==="xiaohongshu"?embeddedJsonString(html,["desc","description"]):"");
  const coverUrl=metaContent(html,["og:image","twitter:image","image"]);
  const uploaderName=metaContent(html,["author","article:author"])||(platform==="xiaohongshu"?embeddedJsonString(html,["nickname","nickName"]):"");
  const recipeNode=scriptJsonLd(html).map(findRecipe).find(Boolean)||null;
  if(recipeNode){
    const extractedRecipe=recipeFromJsonLd(recipeNode);
    const recipeTitle=typeof recipeNode.name==="string"?safeTitle(recipeNode.name,platform):title;
    const recipeAuthor=asRecord(recipeNode.author);
    const author=typeof recipeNode.author==="string"?plainText(recipeNode.author):typeof recipeAuthor?.name==="string"?plainText(recipeAuthor.name):uploaderName;
    return {canonicalUrl:finalUrl,title:recipeTitle||title,uploaderName:author,description:extractedRecipe.summary||description,coverUrl,extractedRecipe,extractionMethod:"json_ld"};
  }
  if(platform==="xiachufang"){
    const extractedRecipe=xiachufangFallback(html);
    if(extractedRecipe)return {canonicalUrl:finalUrl,title,uploaderName,description:extractedRecipe.summary||description,coverUrl,extractedRecipe,extractionMethod:"page_text"};
  }
  if(platform==="xiaohongshu"&&description){
    const extractedRecipe=extractRecipeFromNoteText(description);
    if(extractedRecipe)return {canonicalUrl:finalUrl,title,uploaderName,description,coverUrl,extractedRecipe,extractionMethod:"page_text"};
  }
  return {canonicalUrl:finalUrl,title,uploaderName,description,coverUrl,extractionMethod:"meta"};
}
