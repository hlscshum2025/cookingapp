"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { RecipeEditor } from "@/components/RecipeEditor";
import { useCooking } from "@/components/CookingProvider";

export default function EditRecipePage(){const {id}=useParams<{id:string}>();const {recipes}=useCooking();const recipe=recipes.find(r=>r.id===id);return <div className="page"><header className="page-head"><div><p className="eyebrow">EDIT RECIPE</p><h1>编辑菜谱</h1><p className="subtitle">修改的是你的当前版本，来源视频信息会保留。</p></div><Link className="btn btn-secondary" href={`/recipes/${id}`}>取消</Link></header>{recipe?<RecipeEditor initial={recipe}/>:<div className="panel empty">没有找到这道菜。</div>}</div>}
