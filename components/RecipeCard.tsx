"use client";

import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { useRecipeCart } from "./ShoppingCartProvider";

const statusLabel = { inbox:"待整理",to_try:"待尝试",successful:"已成功",needs_work:"需改进",favorite:"常做" };

type RecipeCardProps={recipe:Recipe;href?:string;coverUrl?:string;publicCard?:boolean;likeCount?:number;liked?:boolean;likeBusy?:boolean;onToggleLike?:()=>void;};

export function RecipeCard({recipe,href,coverUrl,publicCard=false,likeCount=0,liked=false,likeBusy=false,onToggleLike}:RecipeCardProps) {
  const {has,add,remove}=useRecipeCart();
  const selected=has(recipe.id);
  const image=coverUrl||recipe.source?.coverUrl||"";
  const coverStyle=image?{backgroundImage:`linear-gradient(180deg,rgba(24,31,27,.04),rgba(24,31,27,.28)),url(${JSON.stringify(image)})`,backgroundSize:"cover",backgroundPosition:"center"}:{background:recipe.color};
  return <div className="recipe-card-shell">
    <Link href={href||`/recipes/${recipe.id}`} className="recipe-card"><div className={`recipe-cover ${image?"has-image":""}`} style={coverStyle}>{!image&&<span className="cover-emoji">{recipe.emoji}</span>}<span className="cover-status">{statusLabel[recipe.status]}</span></div><div className="recipe-body"><h3 className="recipe-title" title={recipe.title}>{recipe.title}</h3><p className="recipe-desc" title={recipe.summary}>{recipe.summary}</p><div className="meta-row"><span>◷ {recipe.totalMinutes||"?"} 分钟</span><span>♙ {recipe.servings} 人份</span><span>◇ {recipe.difficulty}</span></div><div className="tag-row">{recipe.tags.slice(0,3).map(tag=><span className="tag" key={tag}>{tag}</span>)}</div></div></Link>
    <div className="recipe-card-actions">{publicCard&&<button type="button" className={`recipe-like-add ${liked?"selected":""}`} disabled={likeBusy} aria-label={liked?`取消点赞 ${recipe.title}`:`点赞 ${recipe.title}`} title={liked?"已点赞，点击取消":"喜欢这道公开菜谱"} onClick={onToggleLike}><span aria-hidden="true">{liked?"♥":"♡"}</span><b>{likeCount}</b></button>}<button type="button" className={`recipe-cart-add ${selected?"selected":""}`} aria-label={selected?`从采购车移除 ${recipe.title}`:`把 ${recipe.title} 加入采购车`} title={selected?"已加入采购车，点击移除":"加入采购车"} onClick={()=>selected?remove(recipe.id):add(recipe)}>{selected?"✓":"＋"}<span>🛒</span></button></div>
  </div>;
}
