"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCooking } from "./CookingProvider";

const nav = [
  ["/","⌂","总览"],["/recipes","▦","菜谱库"],["/imports","⇩","导入中心"],["/ingredients","文","食材词典"],["/logs","✎","做菜日志"],["/settings","⚙","设置"]
];
const mobile=nav.slice(0,5);

export function AppShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname(); const {isDemo}=useCooking();
  const active=(href:string)=>href==="/"?pathname===href:pathname.startsWith(href);
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">♨</span><span><strong>CookingApp</strong><span>我的做菜知识库</span></span></Link>
      <nav className="nav" aria-label="主要导航">{nav.map(([href,icon,label])=><Link key={href} href={href} className={active(href)?"active":""}><span className="nav-icon">{icon}</span>{label}</Link>)}</nav>
      <div className="sidebar-note"><b>第一版工作流</b><br/>视频来源 → 我的菜谱 → 每次制作日志。所有待核验信息都会明确标记。</div>
    </aside>
    <main className="content">
      <header className="topbar"><Link className="brand" href="/" style={{margin:0}}><span className="brand-mark">♨</span><span><strong>CookingApp</strong></span></Link><span className="topbar-title">把收藏变成真正会做的菜</span><div className="topbar-actions"><span className="status-pill">{isDemo?"演示模式":"Supabase 已连接"}</span><Link className="avatar" href="/settings" aria-label="打开设置">越</Link></div></header>
      {children}
    </main>
    <nav className="mobile-nav" aria-label="移动端导航">{mobile.map(([href,icon,label])=><Link key={href} href={href} className={active(href)?"active":""}><b>{icon}</b>{label}</Link>)}</nav>
  </div>;
}
