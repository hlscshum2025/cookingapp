(()=>{
  const clean=(value)=>String(value||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
  const text=(node)=>clean(node?.innerText||node?.textContent||"");
  const meta=(key)=>document.querySelector(`meta[property="${key}"]`)?.content||document.querySelector(`meta[name="${key}"]`)?.content||"";
  const url=location.href;
  const noteId=url.match(/\/(?:explore|discovery\/item)\/([0-9a-zA-Z]+)/i)?.[1]||"";
  const dialog=document.querySelector('[role="dialog"]');
  const scope=dialog||document.querySelector("main")||document.body;
  const h1=[...scope.querySelectorAll("h1,h2")].map(text).find(v=>v&&v.length<180)||"";
  const ogTitle=meta("og:title");
  const title=clean(h1||ogTitle||document.title).replace(/\s*[|｜-]\s*小红书.*$/i,"");
  const authorMeta=meta("author");
  const authorCandidate=[...scope.querySelectorAll('a[href*="/user/profile"], [class*="author"], [class*="nickname"], [class*="user-name"]')].map(text).find(v=>v&&v.length<60)||"";
  const author=clean(authorCandidate||authorMeta);
  const candidates=[
    ...scope.querySelectorAll('[class*="note-content"],[class*="desc"],[class*="description"],[class*="content"],article'),
  ].map(text).filter(v=>v.length>20).sort((a,b)=>b.length-a.length);
  let pageText=candidates[0]||text(scope);
  if(pageText.length>20000)pageText=pageText.slice(0,20000);
  const images=[...scope.querySelectorAll("img")]
    .map(img=>({src:img.currentSrc||img.src||"",area:(img.naturalWidth||img.width||0)*(img.naturalHeight||img.height||0)}))
    .filter(item=>/^https?:\/\//i.test(item.src)&&item.area>40000)
    .sort((a,b)=>b.area-a.area);
  const payload={
    schemaVersion:"cookingapp-xiaohongshu-page-1",
    platform:"xiaohongshu",
    noteId,
    url,
    title,
    author,
    coverUrl:images[0]?.src||meta("og:image")||"",
    pageText,
    extractedAt:new Date().toISOString(),
  };
  const json=JSON.stringify(payload,null,2);
  let panel=document.getElementById("cookingapp-xhs-extractor");
  if(panel)panel.remove();
  panel=document.createElement("div");
  panel.id="cookingapp-xhs-extractor";
  Object.assign(panel.style,{position:"fixed",right:"18px",top:"18px",zIndex:"2147483647",width:"360px",maxWidth:"calc(100vw - 36px)",background:"#fffdf8",color:"#203129",border:"1px solid #d8d3c9",borderRadius:"16px",boxShadow:"0 14px 44px rgba(0,0,0,.2)",padding:"16px",fontFamily:"system-ui,sans-serif"});
  panel.innerHTML=`<div style="font-weight:800;font-size:16px;margin-bottom:6px">CookingApp 小红书提取器</div><div style="font-size:13px;line-height:1.5;margin-bottom:12px">已读取当前浏览器里可见的笔记内容。请点击下面按钮复制 JSON，再回 CookingApp 导入中心粘贴。</div><div style="font-size:12px;opacity:.72;margin-bottom:10px">${title||"未识别标题"}${noteId?` · ${noteId}`:""}</div>`;
  const copy=document.createElement("button");
  copy.textContent="复制 CookingApp JSON";
  Object.assign(copy.style,{width:"100%",border:0,borderRadius:"10px",padding:"11px 12px",background:"#2f684f",color:"white",fontWeight:"800",cursor:"pointer"});
  copy.onclick=async()=>{
    try{await navigator.clipboard.writeText(json);copy.textContent="✓ 已复制，回 CookingApp 粘贴";}
    catch{window.prompt("复制下面 JSON，再回 CookingApp 粘贴：",json);}
  };
  const close=document.createElement("button");
  close.textContent="关闭";
  Object.assign(close.style,{width:"100%",marginTop:"8px",border:"1px solid #d8d3c9",borderRadius:"10px",padding:"9px 12px",background:"white",cursor:"pointer"});
  close.onclick=()=>panel.remove();
  panel.append(copy,close);
  document.body.append(panel);
})();
