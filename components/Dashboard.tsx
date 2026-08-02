"use client";

import Link from "next/link";
import { useCooking } from "./CookingProvider";
import { RecipeCard } from "./RecipeCard";

export function Dashboard() {
  const {recipes,logs}=useCooking();
  const successful=recipes.filter(r=>["successful","favorite"].includes(r.status)).length;
  const inbox=recipes.filter(r=>r.status==="inbox").length;
  return <div className="page">
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow" style={{color:"#f0c89e"}}>YOUR PERSONAL COOKBOOK</p><h1>今天，想做点<br/>真正成功过的。</h1><p>把 B 站收藏整理成自己的版本，记录每次调整；以后不再重新翻视频找克数和火候。</p><div className="hero-actions"><Link href="/recipes/new" className="btn btn-primary">＋ 新建菜谱</Link><Link href="/imports" className="btn btn-secondary">导入收藏夹</Link></div></div>
      <div className="hero-board"><div className="mini-stat"><strong>{successful}</strong><span>已验证成功</span></div><div className="mini-stat"><strong>{inbox}</strong><span>等待整理</span></div><div className="mini-stat"><strong>{logs.length}</strong><span>制作记录</span></div><div className="mini-stat"><strong>3</strong><span>中英德语言</span></div></div>
    </section>
    <section className="stats"><div className="stat"><div className="stat-label">全部菜谱</div><div className="stat-value">{recipes.length}</div><small>个人知识库</small></div><div className="stat"><div className="stat-label">常做</div><div className="stat-value">{recipes.filter(r=>r.status==="favorite").length}</div><small>随时可复刻</small></div><div className="stat"><div className="stat-label">待尝试</div><div className="stat-value">{recipes.filter(r=>r.status==="to_try").length}</div><small>下一批候选</small></div><div className="stat"><div className="stat-label">食材映射</div><div className="stat-value">5+</div><small>中英德对照</small></div></section>
    <div className="section-head"><h2>最近更新</h2><Link href="/recipes">查看全部 →</Link></div>
    <div className="recipe-grid">{recipes.slice(0,3).map(recipe=><RecipeCard recipe={recipe} key={recipe.id}/>)}</div>
  </div>;
}
