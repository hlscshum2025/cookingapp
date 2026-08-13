import type { ExtractedRecipeContent } from "./types";

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
};

const urlPattern=/https?:\/\/[^\s<>'"“”‘’，。；;）)】\]]+/i;

function cleanUrl(value:string){
  return value.trim().replace(/[）)\]】>,，。；;]+$/g,"");
}

function cleanSharedTitle(value:string,platformLabel:string){
  let title=value
    .replace(/^[\s\d]+(?=[【\[])/,"")
    .replace(/^[【\[]|[】\]]$/g,"")
    .replace(/\s*[|｜]\s*(?:小红书|下厨房).*$/i,"")
    .trim();
  if(platformLabel==="小红书"){
    const pieces=title.split(/\s+-\s+/).map(piece=>piece.trim()).filter(Boolean);
    if(pieces.length>1&&pieces.at(-1)!.length<=40)title=pieces.slice(0,-1).join(" - ");
  }
  return title.slice(0,160).trim();
}

function titleFromText(text:string,platformLabel:string){
  const withoutUrl=text.replace(new RegExp(urlPattern.source,"gi")," ");
  const bracket=withoutUrl.match(/[【\[]([^】\]]{2,180})[】\]]/);
  if(bracket?.[1]){
    const value=cleanSharedTitle(bracket[1],platformLabel);
    if(value)return value;
  }

  const lines=withoutUrl
    .split(/\r?\n/)
    .map(line=>line.replace(/^\s*\d{1,4}\s+(?=\S)/,"").trim())
    .filter(Boolean);
  const useful=lines.find(line=>{
    if(line.length>160)return false;
    if(/复制.*打开|打开.*看看|分享.*链接|网页链接|^链接[:：]?$/i.test(line))return false;
    if(/^http/i.test(line))return false;
    return true;
  });
  return cleanSharedTitle(useful||"",platformLabel)||`${platformLabel} 待整理来源`;
}

function authorFromText(text:string,platformLabel:string){
  const patterns=[
    /(?:作者|UP主|博主|发布者)[:：]\s*([^\n]{1,60})/i,
    /@([^\s，,。]{1,40})/,
  ];
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match?.[1])return match[1].trim();
  }

  if(platformLabel==="小红书"){
    const bracket=text.match(/[【\[]([^】\]]{2,180})[】\]]/)?.[1]||"";
    const beforePlatform=bracket.replace(/\s*[|｜]\s*小红书.*$/i,"").trim();
    const pieces=beforePlatform.split(/\s+-\s+/).map(piece=>piece.trim()).filter(Boolean);
    if(pieces.length>1&&pieces.at(-1)!.length<=40)return pieces.at(-1)!;
  }
  return "";
}

function stableExternalId(platform:string,url:string,explicit?:string){
  if(explicit)return explicit;
  try{
    const parsed=new URL(url);
    const compact=`${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"");
    return `${platform}-${compact.slice(0,180)}`;
  }catch{
    return `${platform}-${Date.now()}`;
  }
}

export function parseSharedRecipeSource(input:string):ImportedSourceDraft{
  const rawText=input.trim();
  if(!rawText)throw new Error("请先粘贴分享文本或菜谱网页链接。");
  const urlMatch=rawText.match(urlPattern);
  if(!urlMatch)throw new Error("没有识别到 http/https 链接。请把平台的“分享链接”或整段分享文本一起粘贴进来。");
  const url=cleanUrl(urlMatch[0]);
  let host="";
  let pathname="";
  try{
    const parsed=new URL(url);
    host=parsed.hostname.toLowerCase();
    pathname=parsed.pathname;
  }catch{
    throw new Error("链接格式不正确，请重新复制完整分享链接。");
  }

  let platform:ImportedSourceDraft["platform"]="generic_web";
  let platformLabel="普通网页";
  let explicitId="";

  const bv=rawText.match(/BV[0-9A-Za-z]+/i)?.[0];
  if(host.includes("bilibili.com")||host==="b23.tv"||bv){
    platform="bilibili";
    platformLabel="Bilibili";
    explicitId=bv||pathname.match(/\/(BV[0-9A-Za-z]+)/i)?.[1]||"";
  }else if(host.includes("xiachufang.com")){
    platform="xiachufang";
    platformLabel="下厨房";
    explicitId=pathname.match(/\/recipe\/(\d+)/i)?.[1]||"";
  }else if(host.includes("xiaohongshu.com")||host==="xhslink.com"||host.endsWith(".xhslink.com")){
    platform="xiaohongshu";
    platformLabel="小红书";
    explicitId=pathname.match(/\/(?:explore|discovery\/item)\/([0-9a-zA-Z]+)/i)?.[1]||"";
  }

  const title=titleFromText(rawText,platformLabel);
  return {
    platform,
    platformLabel,
    externalId:stableExternalId(platform,url,explicitId),
    url,
    title,
    uploaderName:authorFromText(rawText,platformLabel),
    description:rawText===url?"":rawText.replace(url,"").replace(/\s{2,}/g," ").trim().slice(0,4000),
    coverUrl:"",
    rawText,
  };
}
