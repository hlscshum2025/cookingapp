"use client";

import {useEffect,useState} from "react";
import {hasPwaInstallPrompt,requestPwaInstall,subscribePwaInstallPrompt} from "@/lib/pwa-install";

function isInstalled(){
  if(typeof window==="undefined")return false;
  return window.matchMedia("(display-mode: standalone)").matches
    ||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
}

export function PwaInstallPanel(){
  const [installed,setInstalled]=useState(false);
  const [available,setAvailable]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [isIos]=useState(()=>typeof navigator!=="undefined"&&/iphone|ipad|ipod/i.test(navigator.userAgent));

  useEffect(()=>{
    const sync=()=>{setInstalled(isInstalled());setAvailable(hasPwaInstallPrompt());};
    queueMicrotask(sync);
    const unsubscribe=subscribePwaInstallPrompt(sync);
    const media=window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change",sync);
    window.addEventListener("appinstalled",sync);
    return()=>{unsubscribe();media.removeEventListener?.("change",sync);window.removeEventListener("appinstalled",sync);};
  },[]);

  const install=async()=>{
    setBusy(true);setMessage("");
    try{
      const accepted=await requestPwaInstall();
      setMessage(accepted?"安装请求已接受，可以从桌面或主屏幕打开 CookingApp。":"已取消安装；以后仍可从浏览器菜单安装。");
    }finally{setBusy(false);setInstalled(isInstalled());setAvailable(hasPwaInstallPrompt());}
  };

  return <section className="panel pwa-install-panel">
    <div><p className="eyebrow">INSTALLABLE PWA</p><h2>安装 CookingApp</h2><p className="subtitle">安装后会像普通应用一样出现在桌面或手机主屏幕，并以独立窗口打开；账号和正式数据仍由 Supabase 同步。</p></div>
    <div className="pwa-install-status"><span className={`badge ${installed?"":"warn"}`}>{installed?"已作为应用打开":available?"可以安装":"等待浏览器提供安装入口"}</span>{available&&!installed&&<button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void install()}>{busy?"正在打开安装提示…":"安装到此设备"}</button>}</div>
    {!installed&&!available&&<div className="notice">{isIos?"iPhone / iPad：请使用 Safari 的“分享”按钮，再选择“添加到主屏幕”。":"电脑或 Android：请打开浏览器菜单，选择“安装 CookingApp”或“添加到主屏幕”。浏览器满足条件后，这里也会出现安装按钮。"}</div>}
    <div className="notice pwa-boundary"><b>离线边界：</b>应用外壳和本机草稿可以保留；登录、云端菜谱、批量上传与 Supabase 同步仍需要网络。在中国大陆使用时，网络仍需能够访问 Supabase。</div>
    {message&&<div className="notice notice-success" role="status">{message}</div>}
  </section>;
}
