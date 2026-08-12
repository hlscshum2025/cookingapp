"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCooking } from "./CookingProvider";

const nav = [
  ["/","⌂","总览"],
  ["/recipes","▦","菜谱库"],
  ["/imports","⇩","导入中心"],
  ["/ingredients","文","厨房词典"],
  ["/translations","🛒","采购清单"],
  ["/costs","€","成本核算"],
  ["/logs","✎","做菜日志"],
  ["/tags","#","标签总览"],
  ["/settings","⚙","设置"],
];
const findNav=(href:string)=>nav.find(item=>item[0]===href)!;
const mobile=[findNav("/tags"),findNav("/imports"),findNav("/ingredients"),findNav("/translations"),findNav("/costs")];
const mobileHrefs=new Set(mobile.map(([href])=>href));
const mobileMore=nav.filter(([href])=>!mobileHrefs.has(href));

export function AppShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname(); const router=useRouter(); const {authResolved,authenticated,cloudStatus}=useCooking();
  const [moreOpen,setMoreOpen]=useState(false);
  const active=(href:string)=>href==="/"?pathname===href:pathname.startsWith(href);
  const statusLabel={loading:"正在检查连接",unconfigured:"Supabase 未配置",signed_out:"Supabase 待登录",connected:"Supabase 已连接",error:"Supabase 连接异常"}[cloudStatus];
  useEffect(()=>{if(cloudStatus==="signed_out"&&pathname!=="/login")router.replace(`/login?next=${encodeURIComponent(pathname)}`);},[cloudStatus,pathname,router]);
  useEffect(()=>{if(!authResolved||!authenticated)return;const prefetch=()=>nav.forEach(([href])=>router.prefetch(href));const idle=window.requestIdleCallback?.(prefetch,{timeout:1500});if(idle)return()=>window.cancelIdleCallback?.(idle);const timer=window.setTimeout(prefetch,250);return()=>window.clearTimeout(timer);},[authResolved,authenticated,router]);
  useEffect(()=>{if(!moreOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setMoreOpen(false)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[moreOpen]);
  if(pathname==="/login")return <main className="auth-shell">{children}</main>;
  if(!authResolved||cloudStatus==="signed_out")return <main className="auth-shell"><div className="auth-loading"><span className="brand-mark">♨</span><b>{!authResolved?"正在恢复 CookingApp 会话…":"正在前往登录页…"}</b></div></main>;
  const refreshing=authenticated&&cloudStatus==="loading";
  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark">♨</span><span><strong>CookingApp</strong><span>我的做菜知识库</span></span></Link><nav className="nav" aria-label="主要导航">{nav.map(([href,icon,label])=><Link key={href} href={href} className={active(href)?"active":""}><span className="nav-icon">{icon}</span>{label}</Link>)}</nav><div className="sidebar-note"><b>当前工作流</b><br/>来源待办 → 手工整理 → 菜谱 → 选菜 → 统一采购。</div></aside>
    <main className="content"><header className="topbar"><Link className="brand" href="/" style={{margin:0}}><span className="brand-mark">♨</span><span><strong>CookingApp</strong></span></Link><span className="topbar-title">把收藏变成真正会做的菜</span><div className="topbar-actions"><span className="status-pill">{statusLabel}</span><Link className="avatar" href="/settings" aria-label="打开设置">越</Link></div></header>{refreshing&&<div className="sync-banner" role="status"><span/>正在后台同步最新菜谱；页面可以先使用。</div>}{children}</main>
    {moreOpen&&<div className="mobile-more-layer"><button className="mobile-more-backdrop" aria-label="关闭更多功能" onClick={()=>setMoreOpen(false)}/><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title"><div className="mobile-more-head"><div><p className="eyebrow">全部功能</p><h2 id="mobile-more-title">更多</h2></div><button className="mobile-more-close" aria-label="关闭更多功能" onClick={()=>setMoreOpen(false)}>×</button></div><nav className="mobile-more-grid" aria-label="移动端更多功能">{mobileMore.map(([href,icon,label])=><Link key={href} href={href} onClick={()=>setMoreOpen(false)} className={active(href)?"active":""}><b>{icon}</b><span>{label}</span></Link>)}</nav></section></div>}
    <nav className="mobile-nav" aria-label="移动端导航">{mobile.map(([href,icon,label])=><Link key={href} href={href} className={active(href)?"active":""}><b>{icon}</b>{label}</Link>)}<button type="button" className={mobileMore.some(([href])=>active(href))||moreOpen?"active":""} aria-expanded={moreOpen} aria-controls="mobile-more-title" onClick={()=>setMoreOpen(value=>!value)}><b>•••</b>更多</button></nav>
  </div>;
}
