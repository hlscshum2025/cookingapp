import { NextResponse } from "next/server";
import { extractSourcePage, type SourceExtractionPlatform } from "@/lib/source-extractor";

export const dynamic="force-dynamic";
const MAX_HTML_BYTES=2_000_000;

function allowedHost(hostname:string,platform:SourceExtractionPlatform){
  const host=hostname.toLowerCase();
  if(platform==="xiachufang")return host==="xiachufang.com"||host.endsWith(".xiachufang.com");
  return host==="xiaohongshu.com"||host.endsWith(".xiaohongshu.com")||host==="xhslink.com"||host.endsWith(".xhslink.com");
}

function validateUrl(value:string,platform:SourceExtractionPlatform){
  const url=new URL(value);
  if(url.protocol!=="https:")throw new Error("自动读取只接受 HTTPS 链接。");
  if(!allowedHost(url.hostname,platform))throw new Error("这个链接与所选平台不匹配。");
  return url;
}

function xiachufangUrls(requested:URL){
  const recipeId=requested.pathname.match(/\/recipe\/(\d+)/i)?.[1];
  if(!recipeId)throw new Error("没有从下厨房链接中识别到 recipe ID。");
  return {
    sourceUrl:`https://www.xiachufang.com/recipe/${recipeId}/`,
    readUrl:`https://mip.xiachufang.com/recipe/${recipeId}/`,
  };
}

export async function POST(request:Request){
  try{
    const body=await request.json() as {url?:unknown;platform?:unknown};
    const platform=body.platform==="xiachufang"||body.platform==="xiaohongshu"?body.platform:null;
    if(!platform)return NextResponse.json({error:"目前只处理下厨房和小红书来源。"},{status:400});
    if(typeof body.url!=="string"||!body.url.trim())return NextResponse.json({error:"缺少来源链接。"},{status:400});
    const requested=validateUrl(body.url.trim(),platform);

    if(platform==="xiaohongshu"){
      return NextResponse.json({
        error:"小红书会限制服务器自动读取。请在浏览器中打开笔记并完成人工登录/验证，再使用导入中心里的“小红书网页提取器”。",
        code:"browser_extractor_required",
        canonicalUrl:requested.toString(),
      },{status:409,headers:{"Cache-Control":"no-store"}});
    }

    const {sourceUrl,readUrl}=xiachufangUrls(requested);
    const response=await fetch(readUrl,{redirect:"follow",cache:"no-store",signal:AbortSignal.timeout(9000),headers:{
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      "Accept":"text/html,application/xhtml+xml",
      "Accept-Language":"zh-CN,zh;q=0.9,en;q=0.7",
      "Referer":"https://www.xiachufang.com/",
    }});
    if(!response.ok)return NextResponse.json({error:`下厨房 MIP 页面返回 ${response.status}，暂时无法自动读取。`,canonicalUrl:sourceUrl},{status:502});
    const contentType=response.headers.get("content-type")||"";
    if(!contentType.includes("text/html")&&!contentType.includes("application/xhtml+xml"))return NextResponse.json({error:"下厨房 MIP 没有返回可解析的网页内容。",canonicalUrl:sourceUrl},{status:415});
    const length=Number(response.headers.get("content-length")||0);
    if(length>MAX_HTML_BYTES)return NextResponse.json({error:"原页面过大，已停止自动读取。",canonicalUrl:sourceUrl},{status:413});
    const html=(await response.text()).slice(0,MAX_HTML_BYTES);
    const result=extractSourcePage(html,readUrl,"xiachufang");
    return NextResponse.json({...result,canonicalUrl:sourceUrl,retrievalMethod:"xiachufang_mip"},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch(reason){
    const message=reason instanceof Error&&reason.name==="TimeoutError"?"读取下厨房 MIP 页面超时；来源链接仍可保存，稍后可以重试。":reason instanceof Error?reason.message:"自动读取失败。";
    return NextResponse.json({error:message},{status:400,headers:{"Cache-Control":"no-store"}});
  }
}
