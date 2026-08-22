"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { connectSupabase } from "./supabase";

export const supportedLocales=["zh-CN","zh-TW","en","de"] as const;
export type AppLocale=(typeof supportedLocales)[number];

const localeLabels:Record<AppLocale,string>={
  "zh-CN":"简中",
  "zh-TW":"繁中",
  en:"English",
  de:"Deutsch",
};

const messages={
  "zh-CN":{
    "nav.dashboard":"总览","nav.recipes":"菜谱库","nav.imports":"导入中心","nav.dictionary":"厨房词典","nav.shopping":"采购清单","nav.costs":"成本核算","nav.logs":"做菜日志","nav.tags":"标签总览","nav.settings":"设置","nav.more":"更多",
    "shell.tagline":"把收藏变成真正会做的菜","shell.workflow":"来源待办 → 手工整理 → 菜谱 → 选菜 → 统一采购。","shell.functions":"全部功能","shell.account":"当前账号","shell.openSettings":"账号与设置",
    "status.loading":"正在检查连接","status.unconfigured":"Supabase 未配置","status.signedOut":"Supabase 待登录","status.connected":"Supabase 已连接","status.error":"Supabase 连接异常",
    "language.label":"界面语言","language.note":"先切换导航、状态和主要页面骨架；用户录入的菜名与步骤保持原文。",
    "imports.eyebrow":"统一来源入口","imports.title":"导入中心","imports.subtitle":"先选择来源平台，再查看该平台支持的导入方式与操作说明。","imports.pending":"条待处理",
    "imports.bilibili":"B站","imports.xiaohongshu":"小红书","imports.xiachufang":"下厨房","imports.more":"更多平台",
    "settings.eyebrow":"设置与数据","settings.title":"设置与数据","settings.subtitle":"账号安全、语言偏好、数据库连接、角色权限，以及可验证的备份与恢复。",
  },
  "zh-TW":{
    "nav.dashboard":"總覽","nav.recipes":"食譜庫","nav.imports":"匯入中心","nav.dictionary":"廚房詞典","nav.shopping":"採購清單","nav.costs":"成本核算","nav.logs":"料理日誌","nav.tags":"標籤總覽","nav.settings":"設定","nav.more":"更多",
    "shell.tagline":"把收藏整理成真正會做的料理","shell.workflow":"來源待辦 → 手動整理 → 食譜 → 選菜 → 統一採購。","shell.functions":"全部功能","shell.account":"目前帳號","shell.openSettings":"帳號與設定",
    "status.loading":"正在檢查連線","status.unconfigured":"Supabase 尚未設定","status.signedOut":"Supabase 等待登入","status.connected":"Supabase 已連線","status.error":"Supabase 連線異常",
    "language.label":"介面語言","language.note":"先切換導覽、狀態與主要頁面骨架；使用者輸入的菜名與步驟保留原文。",
    "imports.eyebrow":"統一來源入口","imports.title":"匯入中心","imports.subtitle":"先選擇來源平台，再查看該平台支援的匯入方式與操作說明。","imports.pending":"筆待處理",
    "imports.bilibili":"B站","imports.xiaohongshu":"小紅書","imports.xiachufang":"下廚房","imports.more":"更多平台",
    "settings.eyebrow":"設定與資料","settings.title":"設定與資料","settings.subtitle":"帳號安全、語言偏好、資料庫連線、角色權限，以及可驗證的備份與還原。",
  },
  en:{
    "nav.dashboard":"Overview","nav.recipes":"Recipes","nav.imports":"Import","nav.dictionary":"Kitchen dictionary","nav.shopping":"Shopping","nav.costs":"Costs","nav.logs":"Cooking log","nav.tags":"Tags","nav.settings":"Settings","nav.more":"More",
    "shell.tagline":"Turn saved posts into recipes you can repeat","shell.workflow":"Sources → Review → Recipes → Select → Shop.","shell.functions":"All features","shell.account":"Signed-in account","shell.openSettings":"Account & settings",
    "status.loading":"Checking connection","status.unconfigured":"Supabase not configured","status.signedOut":"Sign-in required","status.connected":"Supabase connected","status.error":"Connection error",
    "language.label":"Interface language","language.note":"This first pass translates navigation, status and the main page structure. User-authored recipe content is never rewritten.",
    "imports.eyebrow":"Unified source entry","imports.title":"Import center","imports.subtitle":"Choose a source first, then view the supported import methods and instructions.","imports.pending":"pending",
    "imports.bilibili":"Bilibili","imports.xiaohongshu":"Xiaohongshu","imports.xiachufang":"Xiachufang","imports.more":"More platforms",
    "settings.eyebrow":"Settings & data","settings.title":"Settings & data","settings.subtitle":"Account security, language, database connection, permissions, backup and restore.",
  },
  de:{
    "nav.dashboard":"Übersicht","nav.recipes":"Rezepte","nav.imports":"Import","nav.dictionary":"Küchenlexikon","nav.shopping":"Einkauf","nav.costs":"Kosten","nav.logs":"Kochprotokoll","nav.tags":"Tags","nav.settings":"Einstellungen","nav.more":"Mehr",
    "shell.tagline":"Gespeicherte Beiträge in nachkochbare Rezepte verwandeln","shell.workflow":"Quellen → Prüfen → Rezepte → Auswählen → Einkaufen.","shell.functions":"Alle Funktionen","shell.account":"Angemeldetes Konto","shell.openSettings":"Konto & Einstellungen",
    "status.loading":"Verbindung wird geprüft","status.unconfigured":"Supabase nicht konfiguriert","status.signedOut":"Anmeldung erforderlich","status.connected":"Supabase verbunden","status.error":"Verbindungsfehler",
    "language.label":"Oberflächensprache","language.note":"Zunächst werden Navigation, Status und die Hauptstruktur übersetzt. Eigene Rezepttexte bleiben unverändert.",
    "imports.eyebrow":"Zentrale Quellen","imports.title":"Importzentrum","imports.subtitle":"Zuerst eine Quelle auswählen, dann Importwege und Anleitung öffnen.","imports.pending":"offen",
    "imports.bilibili":"Bilibili","imports.xiaohongshu":"Xiaohongshu","imports.xiachufang":"Xiachufang","imports.more":"Weitere Plattformen",
    "settings.eyebrow":"Einstellungen & Daten","settings.title":"Einstellungen & Daten","settings.subtitle":"Kontosicherheit, Sprache, Datenbank, Berechtigungen sowie Sicherung und Wiederherstellung.",
  },
} as const;

type MessageKey=keyof (typeof messages)["zh-CN"];
type LocaleContextValue={locale:AppLocale;setLocale:(locale:AppLocale)=>void;t:(key:MessageKey)=>string;localeLabels:typeof localeLabels};
const LocaleContext=createContext<LocaleContextValue|null>(null);
const storageKey="cookingapp.locale.v2";

function isLocale(value:unknown):value is AppLocale{return supportedLocales.includes(value as AppLocale);}
function browserLocale():AppLocale{
  if(typeof navigator==="undefined")return "zh-CN";
  const language=navigator.language.toLowerCase();
  if(language.startsWith("zh-tw")||language.startsWith("zh-hk")||language.startsWith("zh-hant"))return "zh-TW";
  if(language.startsWith("de"))return "de";
  if(language.startsWith("en"))return "en";
  return "zh-CN";
}

export function LocaleProvider({children}:{children:React.ReactNode}){
  const [locale,setLocaleState]=useState<AppLocale>("zh-CN");

  useEffect(()=>{
    let active=true;
    const local=localStorage.getItem(storageKey);
    const fallback=isLocale(local)?local:browserLocale();
    setLocaleState(fallback);
    connectSupabase().then(async s=>{
      if(!s)return;
      const {data:{user}}=await s.auth.getUser();
      if(!user)return;
      const {data}=await s.from("profiles").select("locale").eq("id",user.id).maybeSingle();
      if(active&&isLocale(data?.locale))setLocaleState(data.locale);
    });
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    document.documentElement.lang=locale;
    localStorage.setItem(storageKey,locale);
  },[locale]);

  const setLocale=useCallback((next:AppLocale)=>{
    setLocaleState(next);
    void connectSupabase().then(async s=>{
      if(!s)return;
      const {data:{user}}=await s.auth.getUser();
      if(user)await s.from("profiles").update({locale:next}).eq("id",user.id);
    });
  },[]);

  const t=useCallback((key:MessageKey)=>messages[locale][key]||messages["zh-CN"][key],[locale]);
  const value=useMemo(()=>({locale,setLocale,t,localeLabels}),[locale,setLocale,t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(){
  const value=useContext(LocaleContext);
  if(!value)throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
