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
    "dictionary.eyebrow":"厨房词典","dictionary.title":"厨房词典","dictionary.subtitle":"以稳定词条连接简中、繁中、英文、德文和地区别名；切换语言不会改写菜谱原文。","dictionary.addPersonal":"＋ 补充个人食材",
    "dictionary.builtInIngredients":"内置食材","dictionary.builtInTools":"内置厨具","dictionary.myEntries":"我的补充","dictionary.all":"全部","dictionary.ingredient":"食材","dictionary.tool":"厨具","dictionary.search":"搜：土豆 / 馬鈴薯 / potato / Kartoffel…",
    "dictionary.names":"当前语言与别名","dictionary.english":"English","dictionary.german":"Deutsch","dictionary.category":"分类","dictionary.purchase":"采购 / 说明","dictionary.kitchenTool":"厨房工具","dictionary.empty":"内置词典里暂时没有这个词，可以补充个人食材；厨具缺词后续继续扩充。",
    "dictionary.personalEyebrow":"我的补充","dictionary.personalTitle":"我的食材补充","dictionary.personalSubtitle":"记录实际包装名称、地区叫法和购买经验","dictionary.personalEmpty":"还没有个人补充。遇到地区差异时再把自己的版本补在这里。",
    "dictionary.editTitle":"编辑个人食材","dictionary.addTitle":"补充个人食材","dictionary.zhCN":"简体中文名 *","dictionary.zhTW":"繁体中文名","dictionary.germanHint":"德国购买提示","dictionary.gluten":"无麸质状态","dictionary.verification":"人工校验","dictionary.pending":"待确认","dictionary.confirmed":"已确认","dictionary.save":"保存个人映射","dictionary.safety":"超市位置只用于采购导航，不代表实时有货；过敏原与无麸质结论仍以具体包装为准。",
  },
  "zh-TW":{
    "nav.dashboard":"總覽","nav.recipes":"食譜庫","nav.imports":"匯入中心","nav.dictionary":"廚房詞典","nav.shopping":"採購清單","nav.costs":"成本核算","nav.logs":"料理日誌","nav.tags":"標籤總覽","nav.settings":"設定","nav.more":"更多",
    "shell.tagline":"把收藏整理成真正會做的料理","shell.workflow":"來源待辦 → 手動整理 → 食譜 → 選菜 → 統一採購。","shell.functions":"全部功能","shell.account":"目前帳號","shell.openSettings":"帳號與設定",
    "status.loading":"正在檢查連線","status.unconfigured":"Supabase 尚未設定","status.signedOut":"Supabase 等待登入","status.connected":"Supabase 已連線","status.error":"Supabase 連線異常",
    "language.label":"介面語言","language.note":"先切換導覽、狀態與主要頁面骨架；使用者輸入的菜名與步驟保留原文。",
    "imports.eyebrow":"統一來源入口","imports.title":"匯入中心","imports.subtitle":"先選擇來源平台，再查看該平台支援的匯入方式與操作說明。","imports.pending":"筆待處理",
    "imports.bilibili":"B站","imports.xiaohongshu":"小紅書","imports.xiachufang":"下廚房","imports.more":"更多平台",
    "settings.eyebrow":"設定與資料","settings.title":"設定與資料","settings.subtitle":"帳號安全、語言偏好、資料庫連線、角色權限，以及可驗證的備份與還原。",
    "dictionary.eyebrow":"廚房詞典","dictionary.title":"廚房詞典","dictionary.subtitle":"以穩定詞條連接簡中、繁中、英文、德文與地區別名；切換語言不會改寫食譜原文。","dictionary.addPersonal":"＋ 補充個人食材",
    "dictionary.builtInIngredients":"內建食材","dictionary.builtInTools":"內建廚具","dictionary.myEntries":"我的補充","dictionary.all":"全部","dictionary.ingredient":"食材","dictionary.tool":"廚具","dictionary.search":"搜尋：土豆 / 馬鈴薯 / potato / Kartoffel…",
    "dictionary.names":"目前語言與別名","dictionary.english":"English","dictionary.german":"Deutsch","dictionary.category":"分類","dictionary.purchase":"採購／說明","dictionary.kitchenTool":"廚房工具","dictionary.empty":"內建詞典暫時沒有這個詞，可以補充個人食材；廚具缺詞後續繼續擴充。",
    "dictionary.personalEyebrow":"我的補充","dictionary.personalTitle":"我的食材補充","dictionary.personalSubtitle":"記錄實際包裝名稱、地區稱呼與購買經驗","dictionary.personalEmpty":"尚無個人補充。遇到地區差異時再加入自己的版本。",
    "dictionary.editTitle":"編輯個人食材","dictionary.addTitle":"補充個人食材","dictionary.zhCN":"簡體中文名稱 *","dictionary.zhTW":"繁體中文名稱","dictionary.germanHint":"德國購買提示","dictionary.gluten":"無麩質狀態","dictionary.verification":"人工校驗","dictionary.pending":"待確認","dictionary.confirmed":"已確認","dictionary.save":"儲存個人對應","dictionary.safety":"超市位置只用於採購導覽，不代表即時有貨；過敏原與無麩質結論仍以實際包裝為準。",
  },
  en:{
    "nav.dashboard":"Overview","nav.recipes":"Recipes","nav.imports":"Import","nav.dictionary":"Kitchen dictionary","nav.shopping":"Shopping","nav.costs":"Costs","nav.logs":"Cooking log","nav.tags":"Tags","nav.settings":"Settings","nav.more":"More",
    "shell.tagline":"Turn saved posts into recipes you can repeat","shell.workflow":"Sources → Review → Recipes → Select → Shop.","shell.functions":"All features","shell.account":"Signed-in account","shell.openSettings":"Account & settings",
    "status.loading":"Checking connection","status.unconfigured":"Supabase not configured","status.signedOut":"Sign-in required","status.connected":"Supabase connected","status.error":"Connection error",
    "language.label":"Interface language","language.note":"This first pass translates navigation, status and the main page structure. User-authored recipe content is never rewritten.",
    "imports.eyebrow":"Unified source entry","imports.title":"Import center","imports.subtitle":"Choose a source first, then view the supported import methods and instructions.","imports.pending":"pending",
    "imports.bilibili":"Bilibili","imports.xiaohongshu":"Xiaohongshu","imports.xiachufang":"Xiachufang","imports.more":"More platforms",
    "settings.eyebrow":"Settings & data","settings.title":"Settings & data","settings.subtitle":"Account security, language, database connection, permissions, backup and restore.",
    "dictionary.eyebrow":"Kitchen dictionary","dictionary.title":"Kitchen dictionary","dictionary.subtitle":"Stable terms connect Simplified Chinese, Traditional Chinese, English, German and regional aliases without rewriting recipe text.","dictionary.addPersonal":"＋ Add personal ingredient",
    "dictionary.builtInIngredients":"Built-in ingredients","dictionary.builtInTools":"Built-in tools","dictionary.myEntries":"My additions","dictionary.all":"All","dictionary.ingredient":"Ingredients","dictionary.tool":"Tools","dictionary.search":"Search: 土豆 / 馬鈴薯 / potato / Kartoffel…",
    "dictionary.names":"Current language & aliases","dictionary.english":"English","dictionary.german":"Deutsch","dictionary.category":"Category","dictionary.purchase":"Shopping / notes","dictionary.kitchenTool":"Kitchen tool","dictionary.empty":"No built-in term matches yet. Add a personal ingredient or propose a dictionary term later.",
    "dictionary.personalEyebrow":"My additions","dictionary.personalTitle":"My ingredient additions","dictionary.personalSubtitle":"Record packaging names, regional usage and shopping experience","dictionary.personalEmpty":"No personal additions yet. Add one when you encounter a regional difference.",
    "dictionary.editTitle":"Edit personal ingredient","dictionary.addTitle":"Add personal ingredient","dictionary.zhCN":"Simplified Chinese *","dictionary.zhTW":"Traditional Chinese","dictionary.germanHint":"Germany shopping note","dictionary.gluten":"Gluten-free status","dictionary.verification":"Verification","dictionary.pending":"Pending","dictionary.confirmed":"Confirmed","dictionary.save":"Save personal mapping","dictionary.safety":"Shelf hints are navigation aids, not live stock information. Check the package for allergens and gluten-free claims.",
  },
  de:{
    "nav.dashboard":"Übersicht","nav.recipes":"Rezepte","nav.imports":"Import","nav.dictionary":"Küchenlexikon","nav.shopping":"Einkauf","nav.costs":"Kosten","nav.logs":"Kochprotokoll","nav.tags":"Tags","nav.settings":"Einstellungen","nav.more":"Mehr",
    "shell.tagline":"Gespeicherte Beiträge in nachkochbare Rezepte verwandeln","shell.workflow":"Quellen → Prüfen → Rezepte → Auswählen → Einkaufen.","shell.functions":"Alle Funktionen","shell.account":"Angemeldetes Konto","shell.openSettings":"Konto & Einstellungen",
    "status.loading":"Verbindung wird geprüft","status.unconfigured":"Supabase nicht konfiguriert","status.signedOut":"Anmeldung erforderlich","status.connected":"Supabase verbunden","status.error":"Verbindungsfehler",
    "language.label":"Oberflächensprache","language.note":"Zunächst werden Navigation, Status und die Hauptstruktur übersetzt. Eigene Rezepttexte bleiben unverändert.",
    "imports.eyebrow":"Zentrale Quellen","imports.title":"Importzentrum","imports.subtitle":"Zuerst eine Quelle auswählen, dann Importwege und Anleitung öffnen.","imports.pending":"offen",
    "imports.bilibili":"Bilibili","imports.xiaohongshu":"Xiaohongshu","imports.xiachufang":"Xiachufang","imports.more":"Weitere Plattformen",
    "settings.eyebrow":"Einstellungen & Daten","settings.title":"Einstellungen & Daten","settings.subtitle":"Kontosicherheit, Sprache, Datenbank, Berechtigungen sowie Sicherung und Wiederherstellung.",
    "dictionary.eyebrow":"Küchenlexikon","dictionary.title":"Küchenlexikon","dictionary.subtitle":"Stabile Begriffe verknüpfen vereinfachtes und traditionelles Chinesisch, Englisch, Deutsch und regionale Aliase, ohne Rezepttexte umzuschreiben.","dictionary.addPersonal":"＋ Eigene Zutat ergänzen",
    "dictionary.builtInIngredients":"Enthaltene Zutaten","dictionary.builtInTools":"Enthaltene Geräte","dictionary.myEntries":"Meine Ergänzungen","dictionary.all":"Alle","dictionary.ingredient":"Zutaten","dictionary.tool":"Geräte","dictionary.search":"Suchen: 土豆 / 馬鈴薯 / potato / Kartoffel…",
    "dictionary.names":"Aktuelle Sprache & Aliase","dictionary.english":"English","dictionary.german":"Deutsch","dictionary.category":"Kategorie","dictionary.purchase":"Einkauf / Hinweise","dictionary.kitchenTool":"Küchengerät","dictionary.empty":"Noch kein passender Eintrag. Eine persönliche Zutat kann ergänzt werden.",
    "dictionary.personalEyebrow":"Meine Ergänzungen","dictionary.personalTitle":"Meine Zutaten-Ergänzungen","dictionary.personalSubtitle":"Verpackungsnamen, regionale Begriffe und Einkaufserfahrungen festhalten","dictionary.personalEmpty":"Noch keine persönlichen Ergänzungen. Bei regionalen Unterschieden kann hier eine Variante ergänzt werden.",
    "dictionary.editTitle":"Eigene Zutat bearbeiten","dictionary.addTitle":"Eigene Zutat ergänzen","dictionary.zhCN":"Vereinfachtes Chinesisch *","dictionary.zhTW":"Traditionelles Chinesisch","dictionary.germanHint":"Einkaufshinweis Deutschland","dictionary.gluten":"Glutenfrei-Status","dictionary.verification":"Prüfung","dictionary.pending":"Zu prüfen","dictionary.confirmed":"Bestätigt","dictionary.save":"Eigene Zuordnung speichern","dictionary.safety":"Regalhinweise sind keine Live-Bestandsanzeige. Allergene und Glutenfreiheit immer auf der Verpackung prüfen.",
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
