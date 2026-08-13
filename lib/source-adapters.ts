import type { ExtractedRecipeContent } from "./types";
import { extractRecipeFromNoteText } from "./source-extractor";

export type ImportedSourceDraft={
  platform:"bilibili"|"xiachufang"|"xiaohongshu"|"generic_web";
  platformLabel:string;
  externalId:string;
  url:string;
  title:string;
  uploaderName:string;
  description:string;
  coverUrl:string;
  extractedRecipe?:ExtractedRecipeContent;
  rawText:string;
  browserExtracted?:boolean;
};

const urlPattern=/https?:\/\/[^\s<>'"“”‘’，。；;）)】\]]+/i;

function cleanUrl(value:string){return value.trim().replace(/[）)\]】>,，。；;]+$/g,"");}
function cleanSharedTitle(value:string,platformLabel:string){
  let title=value.replace(/^[\s\d]+(?=[【\[])/,"").replace(/^[【\[]|[】\]]$/g,"").replace(/\s*[|｜]\s*(?:小红书|下厨房).*$/i,"").trim();
  if(platformLabel==="小红书"){
    const pieces=title.split(/\s+-\s+/).map(piece=>piece.trim()).filter(Boolean);
    if(pieces.length>1&&pieces.at(-1)!.length<=40)title=pieces.slice(0,-1).join(" - ");
  }
  return title.slice(0,160).trim();
}
function titleFromText(text:string,platformLabel:string){
  const withoutUrl=text.replace(new RegExp(urlPattern.source,"gi")," ");
  const bracket=withoutUrl.match(/[【\[]([^】\]]{2,180})[】\]]/);
  if(bracket?.[1]){const value=cleanSharedTitle(bracket[1],platformLabel);if(value)return value;}
  const useful=withoutUrl.split(/\r?\n/).map(line=>line.replace(/^\s*\d{1,4}\s+(?=\S)/,"").trim()).filter(Boolean).find(line=>line.length<=160&&!/复制.*打开|打开.*看看|分享.*链接|网页链接|^链接[:：]?$/i.test(line)&&!/^http/i.test(line));
  return cleanSharedTitle(useful||"",platformLabel)||`${platformLabel} 待整理来源`;
}
function authorFromText(text:string,platformLabel:string){
  for(const pattern of [/(?:作者|UP主|博主|发布者)[:：]\s*([^\n]{1,60})/i,/@([^\s，,。]{1,40})/]){const match=text.match(pattern);if(match?.[1])return match[1].trim();}
  if(platformLabel==="小红书"){
    const bracket=text.match(/[【\[]([^】\]]{2,180})[】\]]/)?.[1]||"";
    const pieces=bracket.replace(/\s*[|｜]\s*小红书.*$/i,"").trim().split(/\s+-\s+/).map(piece=>piece.trim()).filter(Boolean);
    if(pieces.length>1&&pieces.at(-1)!.length<=40)return pieces.at(-1)!;
  }
  return "";
}
function stableExternalId(platform:string,url:string,explicit?:string){
  if(explicit)return explicit;
  try{const parsed=new URL(url);const compact=`${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"");return `${platform}-${compact.slice(0,180)}`;}catch{return `${platform}-${Date.now()}`;}
}

function browserExtract(input:string):ImportedSourceDraft|null{
  if(!input.trim().startsWith("{"))return null;
  try{
    const value=JSON.parse(input) as Record<string,unknown>;
    if(value.schemaVersion!=="cookingapp-xiaohongshu-page-1")return null;
    const url=typeof value.url==="string"?value.url.trim():"";
    if(!/^https:\/\/(?:www\.)?xiaohongshu\.com\//i.test(url))throw new Error("小红书网页提取 JSON 缺少有效的原页面链接。");
    const pageText=typeof value.pageText==="string"?value.pageText.trim():"";
    const noteId=typeof value.noteId==="string"?value.noteId.trim():url.match(/\/(?:explore|discovery\/item)\/([0-9a-zA-Z]+)/i)?.[1]||"";
    return {
      platform:"xiaohongshu",platformLabel:"小红书",externalId:stableExternalId("xiaohongshu",url,noteId),url,
      title:(typeof value.title==="string"&&value.title.trim()?cleanSharedTitle(value.title,"小红书"):"小红书 待整理来源"),
      uploaderName:typeof value.author==="string"?value.author.trim():"",
      description:pageText.slice(0,20000),coverUrl:typeof value.coverUrl==="string"?value.coverUrl.trim():"",
      extractedRecipe:extractRecipeFromNoteText(pageText),rawText:input,browserExtracted:true,
    };
  }catch(error){
    if(error instanceof SyntaxError)return null;
    throw error;
  }
}

export function parseSharedRecipeSource(input:string):ImportedSourceDraft{
  const rawText=input.trim();
  if(!rawText)throw new Error("请先粘贴分享文本、菜谱网页链接或小红书网页提取 JSON。");
  const extracted=browserExtract(rawText);if(extracted)return extracted;
  const urlMatch=rawText.match(urlPattern);
  if(!urlMatch)throw new Error("没有识别到 http/https 链接。小红书如果已经打开正文，也可以粘贴网页提取器生成的 JSON。");
  const url=cleanUrl(urlMatch[0]);
  let host="",pathname="";
  try{const parsed=new URL(url);host=parsed.hostname.toLowerCase();pathname=parsed.pathname;}catch{throw new Error("链接格式不正确，请重新复制完整分享链接。");}
  let platform:ImportedSourceDraft["platform"]="generic_web",platformLabel="普通网页",explicitId="";
  const bv=rawText.match(/BV[0-9A-Za-z]+/i)?.[0];
  if(host.includes("bilibili.com")||host==="b23.tv"||bv){platform="bilibili";platformLabel="Bilibili";explicitId=bv||pathname.match(/\/(BV[0-9A-Za-z]+)/i)?.[1]||"";}
  else if(host.includes("xiachufang.com")){platform="xiachufang";platformLabel="下厨房";explicitId=pathname.match(/\/recipe\/(\d+)/i)?.[1]||"";}
  else if(host.includes("xiaohongshu.com")||host==="xhslink.com"||host.endsWith(".xhslink.com")){platform="xiaohongshu";platformLabel="小红书";explicitId=pathname.match(/\/(?:explore|discovery\/item)\/([0-9a-zA-Z]+)/i)?.[1]||"";}
  return {
    platform,platformLabel,externalId:stableExternalId(platform,url,explicitId),url,title:titleFromText(rawText,platformLabel),uploaderName:authorFromText(rawText,platformLabel),
    description:rawText===url?"":rawText.replace(url,"").replace(/\s{2,}/g," ").trim().slice(0,4000),coverUrl:"",rawText,
  };
}
