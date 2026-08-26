"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCooking } from "./CookingProvider";
import { LanguageSelect } from "./LanguageSelect";
import { useLocale } from "@/lib/i18n";

const nav = [
  ["/","⌂","nav.dashboard"],
  ["/recipes","▦","nav.recipes"],
  ["/imports","⇩","nav.imports"],
  ["/ingredients","文","nav.dictionary"],
  ["/translations","🛒","nav.shopping"],
  ["/costs","€","nav.costs"],
  ["/logs","✎","nav.logs"],
  ["/tags","#","nav.tags"],
] as const;
const findNav=(href:string)=>nav.find(item=>item[0]===href)!;
const mobile=[findNav("/tags"),findNav("/imports"),findNav("/ingredients"),findNav("/translations"),findNav("/costs")];
const mobileHrefs=new Set(mobile.map(([href])=>href));
const mobileMore=nav.filter(([href])=>!mobileHrefs.has(href));

export function AppShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname(); const router=useRouter(); const {authResolved,authenticated,currentUserEmail,cloudStatus}=useCooking();
  const {t}=useLocale();
  const [moreOpen,setMoreOpen]=useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const accountMenuRef=useRef<HTMLDivElement>(null);
  const active=(href:string)=>href==="/costs"
    ?pathname==="/costs"||pathname.startsWith("/costs/")||pathname.startsWith("/gatherings")||pathname.startsWith("/ledger")
    :href==="/"?pathname===href:pathname.startsWith(href);
  const statusLabel={loading:t("status.loading"),unconfigured:t("status.unconfigured"),signed_out:t("status.signedOut"),connected:t("status.connected"),error:t("status.error")}[cloudStatus];
  useEffect(()=>{if(cloudStatus==="signed_out"&&pathname!=="/login")router.replace(`/login?next=${encodeURIComponent(pathname)}`);},[cloudStatus,pathname,router]);
  useEffect(()=>{if(!moreOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setMoreOpen(false)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[moreOpen]);
  useEffect(()=>{document.body.classList.toggle("mobile-menu-open",moreOpen);return()=>document.body.classList.remove("mobile-menu-open");},[moreOpen]);
  useEffect(()=>{if(!accountOpen)return;const close=(event:MouseEvent|KeyboardEvent)=>{if(event instanceof KeyboardEvent){if(event.key==="Escape")setAccountOpen(false);return;}if(!accountMenuRef.current?.contains(event.target as Node))setAccountOpen(false);};window.addEventListener("mousedown",close);window.addEventListener("keydown",close);return()=>{window.removeEventListener("mousedown",close);window.removeEventListener("keydown",close);};},[accountOpen]);
  if(pathname==="/login")return <main className="auth-shell">{children}</main>;
  if(!authResolved||cloudStatus==="signed_out")return <main className="auth-shell"><div className="auth-loading"><span className="brand-mark">♨</span><b>{!authResolved?"正在恢复 CookingApp 会话…":"正在前往登录页…"}</b></div></main>;
  const refreshing=authenticated&&cloudStatus==="loading";
  return <div className="app-shell">
    <aside className="sidebar"><Link prefetch={false} className="brand" href="/"><span className="brand-mark">♨</span><span><strong>CookingApp</strong><span>My cooking knowledge base</span></span></Link><nav className="nav" aria-label="主要导航">{nav.map(([href,icon,label])=><Link prefetch={false} key={href} href={href} className={active(href)?"active":""} aria-current={active(href)?"page":undefined}><span className="nav-icon">{icon}</span>{t(label)}</Link>)}</nav><div className="sidebar-note"><b>Workflow</b><br/>{t("shell.workflow")}</div></aside>
    <main className="content"><header className="topbar"><Link prefetch={false} className="brand" href="/" style={{margin:0}}><span className="brand-mark">♨</span><span><strong>CookingApp</strong></span></Link><span className="topbar-title">{t("shell.tagline")}</span><div className="topbar-actions" ref={accountMenuRef}><button type="button" className={`avatar account-trigger ${cloudStatus==="connected"?"is-connected":"is-offline"}`} aria-label={t("shell.openSettings")} aria-expanded={accountOpen} aria-controls="account-menu" title={statusLabel} onClick={()=>setAccountOpen(value=>!value)}>越{cloudStatus!=="connected"&&<span className="account-alert" aria-label="1 条连接信息">1</span>}</button>{accountOpen&&<section id="account-menu" className="account-menu" role="dialog" aria-label={t("shell.openSettings")}><div className="account-menu-head"><span className={`avatar ${cloudStatus==="connected"?"is-connected":"is-offline"}`}>越</span><div><small>{t("shell.account")}</small><b>{currentUserEmail||"CookingApp"}</b></div></div><div className="account-menu-language"><span>{t("language.label")}</span><LanguageSelect compact/></div><Link prefetch={false} className="account-menu-link" href="/settings" onClick={()=>setAccountOpen(false)}><span>⚙</span>{t("nav.settings")}<b>→</b></Link></section>}</div></header>{refreshing&&<div className="sync-banner" role="status"><span/>Supabase 正在连接并同步；页面可以继续使用。</div>}{authenticated&&cloudStatus==="error"&&<div className="sync-banner sync-banner-error" role="status"><span/>Supabase 暂未连接，正在显示最近一次数据。<Link href="/settings">前往设置重试 →</Link></div>}{children}</main>
    {moreOpen&&<div className="mobile-more-layer"><button className="mobile-more-backdrop" aria-label="关闭更多功能" onClick={()=>setMoreOpen(false)}/><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title"><div className="mobile-more-head"><div><p className="eyebrow">{t("shell.functions")}</p><h2 id="mobile-more-title">{t("nav.more")}</h2></div><button className="mobile-more-close" aria-label="关闭更多功能" onClick={()=>setMoreOpen(false)}>×</button></div><div className="mobile-account-card"><span className={`avatar ${cloudStatus==="connected"?"is-connected":"is-offline"}`}>越</span><div><small>{t("shell.account")}</small><b>{currentUserEmail||statusLabel}</b></div><Link prefetch={false} href="/settings" onClick={()=>setMoreOpen(false)}>{t("shell.openSettings")} →</Link></div><div className="mobile-language-row"><span>{t("language.label")}</span><LanguageSelect compact/></div><nav className="mobile-more-grid" aria-label="移动端更多功能">{mobileMore.map(([href,icon,label])=><Link prefetch={false} key={href} href={href} onClick={()=>setMoreOpen(false)} className={active(href)?"active":""} aria-current={active(href)?"page":undefined}><b>{icon}</b><span>{t(label)}</span></Link>)}</nav></section></div>}
    <nav className="mobile-nav" aria-label="移动端导航">{mobile.map(([href,icon,label])=><Link prefetch={false} key={href} href={href} className={active(href)?"active":""} aria-current={active(href)?"page":undefined}><b>{icon}</b>{t(label)}</Link>)}<button type="button" className={mobileMore.some(([href])=>active(href))||moreOpen?"active":""} aria-expanded={moreOpen} aria-controls="mobile-more-title" onClick={()=>setMoreOpen(value=>!value)}><b>•••</b>{t("nav.more")}</button></nav>
  </div>;
}
