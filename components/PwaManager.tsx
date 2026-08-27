"use client";

import {useEffect} from "react";
import {clearPwaInstallPrompt,rememberPwaInstallPrompt,type PwaInstallPrompt} from "@/lib/pwa-install";

export function PwaManager(){
  useEffect(()=>{
    const local=location.hostname==="localhost"||location.hostname==="127.0.0.1";
    if("serviceWorker" in navigator&&(location.protocol==="https:"||local)){
      void navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});
    }
    const beforeInstall=(event:Event)=>{
      event.preventDefault();
      rememberPwaInstallPrompt(event as Event&PwaInstallPrompt);
    };
    const installed=()=>clearPwaInstallPrompt();
    window.addEventListener("beforeinstallprompt",beforeInstall);
    window.addEventListener("appinstalled",installed);
    return()=>{
      window.removeEventListener("beforeinstallprompt",beforeInstall);
      window.removeEventListener("appinstalled",installed);
    };
  },[]);
  return null;
}

