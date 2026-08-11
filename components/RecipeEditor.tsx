"use client";

import { useMemo, useState } from "react";
import { useCooking } from "./CookingProvider";
import { RecipeTagEditor } from "./RecipeTagEditor";
import type { Recipe } from "@/lib/types";

const blank:Recipe={id:"",title:"",summary:"",emoji:"🍳",color:"linear-gradient(135deg,#e8c990,#d68353)",servings:2,totalMinutes:30,difficulty:"简单",status:"to_try",visibility:"private",tags:[],tools:[],ingredients:[{id:"i-1",name:"",amount:"",unit:""}],steps:[{id:"s-1",instruction:""}],versionNote:"",updatedAt:""};
const ingredientUnits=["g","kg","mg","ml","L","勺","小勺","大勺","茶匙","汤匙","圈","瓶盖","杯","碗","个","颗","枚","只","根","瓣","片","段","块","条","把","撮","少许","适量"];

export function RecipeEditor({initial}:{initial?:Recipe}) {
  const [recipe,setRecipe]=useState<Recipe>(initial||blank); const [saved,setSaved]=useState(false); const {saveRecipe,recipes}=useCooking();
  const tagSuggestions=useMemo(()=>[...new Set(recipes.flatMap(item=>item.tags))],[recipes]);
  const update=<K extends keyof Recipe>(key:K,value:Recipe[K])=>setRecipe(r=>({...r,[key]:value}));
  const submit=(e:React.FormEvent)=>{e.preventDefault(); const id=recipe.id||`${Date.now()}-${recipe.title.replace(/\s+/g,"-").slice(0,24)}`; saveRecipe({...recipe,id,updatedAt:new Date().toISOString().slice(0,10),tags:recipe.tags.map(tag=>tag.trim()).filter(Boolean)}); setSaved(true); setTimeout(()=>window.location.assign(`/recipes/${id}`),450);};
  return <form onSubmit={submit} className="two-col">
    <datalist id="recipe-ingredient-unit-options">{ingredientUnits.map(unit=><option value={unit} key={unit}/>)}</datalist>
    <section className="panel"><h2>基本信息</h2><div className="form-grid">
      <div className="field full"><label>菜名 *</label><input required value={recipe.title} onChange={e=>update("title",e.target.value)} placeholder="例如：番茄炖牛腩"/><small>菜名只是显示标题，可以按自己的习惯修改；分类和查找主要依赖食材、来源作者和内容标签。</small></div>
      <div className="field full"><label>一句话说明</label><textarea value={recipe.summary} onChange={e=>update("summary",e.target.value)} placeholder="这道菜适合什么时候做，以及你的版本有什么特点"/></div>
      <div className="field"><label>份数</label><input type="number" min="1" value={recipe.servings} onChange={e=>update("servings",Number(e.target.value))}/></div><div className="field"><label>总时间（分钟）</label><input type="number" min="0" value={recipe.totalMinutes} onChange={e=>update("totalMinutes",Number(e.target.value))}/></div>
      <div className="field"><label>难度</label><select value={recipe.difficulty} onChange={e=>update("difficulty",e.target.value as Recipe["difficulty"])}><option>简单</option><option>中等</option><option>进阶</option></select></div>
      <div className="field"><label>状态</label><select value={recipe.status} onChange={e=>update("status",e.target.value as Recipe["status"])}><option value="inbox">待整理</option><option value="to_try">待尝试</option><option value="successful">已成功</option><option value="needs_work">需改进</option><option value="favorite">常做</option></select></div>
      <div className="field full"><label>菜谱标签</label><RecipeTagEditor value={recipe.tags} onChange={tags=>update("tags",tags)} suggestions={tagSuggestions}/></div>
    </div><div className="divider"/><div className="section-head"><div><h2>食材</h2><p className="subtitle">食材名会自动进入“标签总览”的食材筛选，不需要再重复添加成标签。</p></div><button type="button" className="btn btn-secondary" onClick={()=>update("ingredients",[...recipe.ingredients,{id:crypto.randomUUID(),name:"",amount:"",unit:""}])}>＋ 添加</button></div>
    {recipe.ingredients.map((item,index)=><div className="array-row" key={item.id}><input aria-label="食材名" value={item.name} onChange={e=>update("ingredients",recipe.ingredients.map((x,i)=>i===index?{...x,name:e.target.value}:x))} placeholder="食材"/><input aria-label="用量" value={item.amount} onChange={e=>update("ingredients",recipe.ingredients.map((x,i)=>i===index?{...x,amount:e.target.value}:x))} placeholder="用量"/><input aria-label="单位" list="recipe-ingredient-unit-options" value={item.unit} onChange={e=>update("ingredients",recipe.ingredients.map((x,i)=>i===index?{...x,unit:e.target.value}:x))} placeholder="g／勺／圈／片／个…"/><input aria-label="处理方式" value={item.preparation||""} onChange={e=>update("ingredients",recipe.ingredients.map((x,i)=>i===index?{...x,preparation:e.target.value}:x))} placeholder="切块、切末…"/><button type="button" className="icon-btn" onClick={()=>update("ingredients",recipe.ingredients.filter((_,i)=>i!==index))}>×</button></div>)}
    <div className="divider"/><div className="section-head"><h2>步骤</h2><button type="button" className="btn btn-secondary" onClick={()=>update("steps",[...recipe.steps,{id:crypto.randomUUID(),instruction:""}])}>＋ 添加</button></div>
    {recipe.steps.map((step,index)=><div className="array-row step-row" key={step.id}><span className="step-no">{index+1}</span><textarea aria-label={`步骤 ${index+1}`} value={step.instruction} onChange={e=>update("steps",recipe.steps.map((x,i)=>i===index?{...x,instruction:e.target.value}:x))} placeholder="写下具体操作、火候和判断标准"/><input aria-label="分钟" type="number" min="0" value={step.minutes||""} onChange={e=>update("steps",recipe.steps.map((x,i)=>i===index?{...x,minutes:Number(e.target.value)||undefined}:x))} placeholder="分钟"/><button type="button" className="icon-btn" onClick={()=>update("steps",recipe.steps.filter((_,i)=>i!==index))}>×</button></div>)}
    </section>
    <aside><div className="panel" style={{position:"sticky",top:96}}><h2>我的版本</h2><div className="field"><label>本次版本说明</label><textarea value={recipe.versionNote} onChange={e=>update("versionNote",e.target.value)} placeholder="例如：糖减半；最后提高温度上色"/></div><div className="field" style={{marginTop:14}}><label>可见范围</label><select value={recipe.visibility} onChange={e=>update("visibility",e.target.value as Recipe["visibility"])}><option value="private">仅自己</option><option value="public">公开只读</option></select></div><div className="notice" style={{marginTop:16}}>用量、温度、无麸质和替代品如果没有确认，请保留为空或写明“待核验”，不要根据视频标题猜测。</div><button className="btn btn-primary" style={{width:"100%",marginTop:18}} type="submit">保存菜谱</button></div></aside>
    {saved&&<div className="toast">已保存，正在打开菜谱…</div>}
  </form>;
}
