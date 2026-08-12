import Link from "next/link";
import { RecipeEditor } from "@/components/RecipeEditor";
import { SubpageBack } from "@/components/SubpageBack";

export default function NewRecipePage(){return <div className="page"><header className="page-head"><div><p className="eyebrow">NEW RECIPE</p><h1>新建菜谱</h1><p className="subtitle">先把确定的信息写下来，未知字段可以以后补。</p></div><Link className="btn btn-secondary" href="/recipes">取消</Link></header><SubpageBack href="/recipes" label="返回菜谱库"/><RecipeEditor/></div>}
