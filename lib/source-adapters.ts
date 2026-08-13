export type ImportedSourceDraft={
  platform:"bilibili"|"xiachufang"|"xiaohongshu"|"generic_web";
  platformLabel:string;
  externalId:string;
  url:string;
  title:string;
  uploaderName:string;
  description:string;
  rawText:string;
};

const urlPattern=/https?:\/\/[^\s<>'"，。；;）)]+/i;

function cleanUrl(value:string){
  return value.trim().replace(/[）)\]】>,，。；;]+$/g,"");
}

function titleFromText(text:string,platformLabel:string){
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const useful=lines.find(line=>{
    if(/^https?:\/\//i.test(line))return false;
    if(line.length>140)return false;
    if(/复制.*打开|打开.*看看|分享.*链接|网页链接|^链接[:：]?$/i.test(line))return false;
    return true;
  });
  return useful?.replace(/^【|】$/g,"").trim()||`${platformLabel} 待整理来源`;
}

function authorFromText(text:string){
  const patterns=[
    /(?:作者|UP主|博主|发布者)[:：]\s*([^\n]{1,60})/i,
    /@([^\s，,。]{1,40})/,
  ];
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match?.[1])return match[1].trim();
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
    uploaderName:authorFromText(rawText),
    description:rawText===url?"":rawText.slice(0,4000),
    rawText,
  };
}
