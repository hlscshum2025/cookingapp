"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCooking } from "./CookingProvider";

const nav = [
  ["/","⌂","总览"],
  ["/recipes","▦","菜谱库"],
  ["/imports","⇩","导入中心"],
  ["/video-review","▶","视频审核"],
  ["/manual-entry","＋","手动录入"],
  ["/ingredients","文","食材词典"],
  ["/translations","译","翻译采购"],
  ["/costs","€","成本核算"],
  ["/logs","✎","做菜日志"],
  ["/tags","#","标签总览"],
  ["/settings","⚙","设置"],
];
const mobile=[nav[0],nav[1],nav[2],nav[4],nav[7]];

export function AppShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname(); const {cloudStatus}=useCooking();
  const active=(href:string)=>href==="/"?pathname===href:pathname.startsWith(href);
  const statusLabel={loading:"正在检查连接",unconfigured:"Supabase 未配置",signed_out:"Supabase 待登录",connected:"Supabase 已连接",error:"Supabase 连接异常"}[cloudStatus];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">♨</span><span><strong>CookingApp</strong><span>我的做菜知识库</span></span></Link>
      <nav className="nav" aria-label="主要导航">{nav.map(([href,icon,label])=><Link key={href} href={href} className={active(href)?"active":""}><span className="nav-icon">{icon}</span>{label}</Link>)}</nav>
      <div className="sidebar-note"><b>第一版工作流</b><br/>视频来源 → 字幕与画面核验 → 来源菜谱。所有缺失信息都会明确标记。</div>
    </aside>
    <main className="content">
      <header className="topbar"><Link className="brand" href="/" style={{margin:0}}><span className="brand-mark">♨</span><span><strong>CookingApp</strong></span></Link><span className="topbar-title">把收藏变成真正会做的菜</span><div className="topbar-actions"><span className="status-pill">{statusLabel}</span><Link className="avatar" href="/settings" aria-label="打开设置">越</Link></div></header>
      {children}
    </main>
    <nav className="mobile-nav" aria-label="移动端导航">{mobile.map(([href,icon,label])=><Link key={href} href={href} className={active(href)?"active":""}><b>{icon}</b>{label}</Link>)}</nav>
  </div>;
}
