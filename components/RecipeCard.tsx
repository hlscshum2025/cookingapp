import Link from "next/link";
import type { Recipe } from "@/lib/types";

const statusLabel = { inbox:"待整理",to_try:"待尝试",successful:"已成功",needs_work:"需改进",favorite:"常做" };

export function RecipeCard({recipe}:{recipe:Recipe}) {
  return <Link href={`/recipes/${recipe.id}`} className="recipe-card">
    <div className="recipe-cover" style={{background:recipe.color}}><span className="cover-emoji">{recipe.emoji}</span><span className="cover-status">{statusLabel[recipe.status]}</span></div>
    <div className="recipe-body"><h3 className="recipe-title" title={recipe.title}>{recipe.title}</h3><p className="recipe-desc" title={recipe.summary}>{recipe.summary}</p><div className="meta-row"><span>◷ {recipe.totalMinutes||"?"} 分钟</span><span>♙ {recipe.servings} 人份</span><span>◇ {recipe.difficulty}</span></div><div className="tag-row">{recipe.tags.slice(0,3).map(tag=><span className="tag" key={tag}>{tag}</span>)}</div></div>
  </Link>;
}
