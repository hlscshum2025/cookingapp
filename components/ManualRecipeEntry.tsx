"use client";

import { useEffect, useMemo, useState } from "react";
import { useCooking } from "./CookingProvider";
import {
  createDraftFromSource,
  createManualRowId,
  mergeStoredManualDraftWithSource,
  prepareManualEntryPayload,
  type ManualEvidence,
  type ManualRecipeDraft,
} from "@/lib/manual-entry";
import { queueManualEntry } from "@/lib/manual-entry-queue";
import { parseBilibiliSubtitleExport } from "@/lib/video-review";
import type { SourceVideo } from "@/lib/types";

const evidenceOptions: Array<{ value: ManualEvidence["kind"]; label: string }> = [
  { value: "manual", label: "人工填写" },
  { value: "subtitle", label: "AI 字幕" },
  { value: "video_text", label: "视频画面文字" },
];

const ingredientUnits = [
  "g", "kg", "mg", "ml", "L",
  "勺", "小勺", "大勺", "茶匙", "汤匙",
  "圈", "瓶盖", "杯", "碗",
  "个", "颗", "枚", "只", "根", "瓣",
  "片", "段", "块", "条", "把", "撮",
  "少许", "适量",
];

function draftKey(source?:SourceVideo){
  return `cookingapp:manual-draft:${source?.externalId||source?.id||"new"}`;
}

export function ManualRecipeEntry({initialSource}:{initialSource?:SourceVideo}={}) {
  const { currentUserId } = useCooking();
  const storageKey=useMemo(()=>draftKey(initialSource),[initialSource]);
  const [draft, setDraft] = useState<ManualRecipeDraft>(() => createDraftFromSource(initialSource));
  const [draftReady,setDraftReady]=useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      setDraftReady(false);
      const fresh=createDraftFromSource(initialSource);
      try{
        const stored=window.localStorage.getItem(storageKey);
        setDraft(stored?mergeStoredManualDraftWithSource(JSON.parse(stored) as ManualRecipeDraft,initialSource):fresh);
      }catch{
        setDraft(fresh);
      }
      setDraftReady(true);
    });
    return()=>{active=false;};
  },[initialSource,storageKey]);

  useEffect(()=>{
    if(!draftReady)return;
    const timer=window.setTimeout(()=>{
      try{window.localStorage.setItem(storageKey,JSON.stringify(draft));}catch{}
    },250);
    return()=>window.clearTimeout(timer);
  },[draft,draftReady,storageKey]);

  const clearLocalDraft=()=>{
    try{window.localStorage.removeItem(storageKey);}catch{}
    setDraft(createDraftFromSource(initialSource));
    setMessage("本机草稿已清空，已恢复为这个来源的初始内容。");
  };

  const setSource = <K extends keyof ManualRecipeDraft["source"]>(key: K, value: ManualRecipeDraft["source"][K]) => {
    setDraft((current) => ({ ...current, source: { ...current.source, [key]: value } }));
  };
  const setRecipe = <K extends keyof ManualRecipeDraft["recipe"]>(key: K, value: ManualRecipeDraft["recipe"][K]) => {
    setDraft((current) => ({ ...current, recipe: { ...current.recipe, [key]: value } }));
  };

  const updateIngredient=(index:number,patch:Partial<ManualRecipeDraft["recipe"]["ingredients"][number]>)=>{
    setRecipe("ingredients",draft.recipe.ingredients.map((value,itemIndex)=>itemIndex===index?{...value,...patch}:value));
  };

  const importSubtitle = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const parsed = parseBilibiliSubtitleExport(JSON.parse(await file.text()), {
        bvid: draft.source.externalId,
        title: draft.source.title || draft.recipe.title,
        url: draft.source.url,
      });
      setDraft((current) => ({
        ...current,
        source: {
          ...current.source,
          externalId: current.source.externalId || parsed.video.bvid,
          url: current.source.url || parsed.video.url,
        },
        subtitle: parsed,
        review: { ...current.review, verificationStatus: "ai_suggested" },
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "字幕 JSON 读取失败。");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!currentUserId) {
      setError("当前登录账号尚未恢复，暂时不能建立账号隔离的本机上传队列。");
      return;
    }
    setSaving(true);
    try {
      const queued=await queueManualEntry(currentUserId,prepareManualEntryPayload(draft));
      try{window.localStorage.removeItem(storageKey);}catch{}
      setMessage(`“${queued.payload.recipe.title}”已存入本机待上传队列。你可以继续整理下一道，最后在导入中心一键上传。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  const isBilibili=draft.source.platform==="bilibili";

  return <form onSubmit={submit} className="manual-entry-layout">
    <datalist id="ingredient-unit-options">{ingredientUnits.map(unit=><option value={unit} key={unit}/>)}</datalist>
    <div className="mobile-manual-toolbar"><span><b>草稿自动保存</b><small>继续填写不会丢失</small></span><button type="button" className="btn btn-secondary" onClick={()=>document.getElementById("manual-review-panel")?.scrollIntoView({behavior:"smooth",block:"start"})}>核验与保存 ↓</button></div>
    <section className="manual-entry-main">
      <div className="notice manual-draft-notice"><b>自动草稿与本机队列已开启。</b> 填写过程会保存在当前浏览器；核验完成后先存入本机待上传队列，可以连续整理多道菜，最后再统一上传 Supabase。</div>

      <div className="panel">
        <div className="section-head"><div><p className="eyebrow">SOURCE</p><h2>来源与辅助资料</h2></div><span className={`badge ${draft.subtitle ? "" : "warn"}`}>{draft.subtitle ? `${draft.subtitle.tracks.reduce((sum, track) => sum + track.cues.length, 0)} 段字幕` : isBilibili?"字幕可选":"分享文本已保留"}</span></div>
        <div className="form-grid">
          <div className="field"><label>来源类型</label><select value={draft.source.platform} onChange={(event) => setSource("platform", event.target.value as ManualRecipeDraft["source"]["platform"])}><option value="bilibili">Bilibili</option><option value="xiachufang">下厨房</option><option value="xiaohongshu">小红书</option><option value="generic_web">普通网页</option><option value="manual">无网页／手动来源</option></select></div>
          <div className="field"><label>{isBilibili?"BV 号":"来源 ID"}</label><input value={draft.source.externalId} onChange={(event) => setSource("externalId", event.target.value.trim())} placeholder={isBilibili?"BV1…":"平台 ID 或自动生成的来源 ID"}/></div>
          <div className="field full"><label>来源标题</label><input value={draft.source.title} onChange={(event) => setSource("title", event.target.value)} placeholder="原页面／视频标题；可与菜名不同"/></div>
          <div className="field full"><label>来源链接</label><input type="url" value={draft.source.url} onChange={(event) => setSource("url", event.target.value)} placeholder={isBilibili?"留空时可根据 BV 号生成":"原始分享链接或菜谱网页地址"}/></div>
          <div className="field"><label>作者／UP 主</label><input value={draft.source.uploaderName} onChange={(event) => setSource("uploaderName", event.target.value)}/></div>
          {isBilibili&&<div className="field"><label>时长（秒）</label><input type="number" min="0" value={draft.source.durationSeconds ?? ""} onChange={(event) => setSource("durationSeconds", event.target.value ? Number(event.target.value) : undefined)}/></div>}
          <div className="field full"><label>来源说明／分享文本</label><textarea value={draft.source.description} onChange={(event) => setSource("description", event.target.value)} placeholder="简介、分享文案、画面信息或需要再次确认的地方"/></div>
          {isBilibili&&<div className="field full"><label>AI 字幕 JSON</label><input type="file" accept="application/json,.json" onChange={(event) => importSubtitle(event.target.files?.[0])}/><small>原始 B 站 `body` 格式和 CookingApp 包装格式都可以。原始文件请先填写 BV 号。</small></div>}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">RECIPE</p><h2>菜谱正文</h2>
        <div className="form-grid">
          <div className="field full"><label>菜名 *</label><input required value={draft.recipe.title} onChange={(event) => setRecipe("title", event.target.value)} placeholder="例如：洋葱辣酸奶酱"/></div>
          <div className="field full"><label>同一来源中的配方标识</label><input required value={draft.recipe.candidateKey} onChange={(event) => setRecipe("candidateKey", event.target.value)} placeholder="main、sauce-1…"/><small>同一来源包含多道菜时必须不同；再次保存同一标识会更新原记录。</small></div>
          <div className="field full"><label>摘要</label><textarea value={draft.recipe.summary} onChange={(event) => setRecipe("summary", event.target.value)}/></div>
          <div className="field"><label>份数</label><input type="number" min="1" value={draft.recipe.servings} onChange={(event) => setRecipe("servings", Number(event.target.value))}/></div>
          <div className="field"><label>总时间（分钟）</label><input type="number" min="0" value={draft.recipe.totalMinutes} onChange={(event) => setRecipe("totalMinutes", Number(event.target.value))}/></div>
          <div className="field"><label>难度</label><select value={draft.recipe.difficulty} onChange={(event) => setRecipe("difficulty", event.target.value as ManualRecipeDraft["recipe"]["difficulty"])}><option>简单</option><option>中等</option><option>进阶</option></select></div>
          <div className="field"><label>状态</label><select value={draft.recipe.status} onChange={(event) => setRecipe("status", event.target.value as ManualRecipeDraft["recipe"]["status"])}><option value="inbox">待整理</option><option value="to_try">待尝试</option><option value="successful">已成功</option><option value="needs_work">需改进</option><option value="favorite">常做</option></select></div>
          <div className="field full"><label>标签（逗号分隔）</label><input value={draft.recipe.tags.join("，")} onChange={(event) => setRecipe("tags", event.target.value.split(/[，,]/).map((item) => item.trim()))}/></div>
          <div className="field full"><label>厨具（逗号分隔）</label><input value={draft.recipe.tools.join("，")} onChange={(event) => setRecipe("tools", event.target.value.split(/[，,]/).map((item) => item.trim()))}/></div>
        </div>
      </div>

      <div className="panel">
        <div className="section-head"><div><h2>食材与证据</h2><p className="subtitle">单位可直接输入，也可从建议中选择：克/毫升、勺/圈、个/颗、片/段、少许/适量等都支持。</p></div><button type="button" className="btn btn-secondary" onClick={() => setRecipe("ingredients", [...draft.recipe.ingredients, { id: createManualRowId("ingredient"), name: "", amount: "", unit: "", evidence: { kind: "manual" } }])}>＋ 添加食材</button></div>
        {draft.recipe.ingredients.map((item, index) => <div className="manual-array-card" key={item.id}>
          <div className="array-row"><input aria-label={`食材 ${index + 1}`} value={item.name} onChange={(event) => updateIngredient(index,{name:event.target.value})} placeholder="食材，如姜／酱油"/><input aria-label="用量" value={item.amount} onChange={(event) => updateIngredient(index,{amount:event.target.value})} placeholder="用量，如2／1.5"/><input aria-label="单位" list="ingredient-unit-options" value={item.unit} onChange={(event) => updateIngredient(index,{unit:event.target.value})} placeholder="g／勺／圈／片／个…"/><input aria-label="处理方式" value={item.preparation ?? ""} onChange={(event) => updateIngredient(index,{preparation:event.target.value})} placeholder="切片／切段／切末…"/><button type="button" className="icon-btn" aria-label="删除食材" onClick={() => setRecipe("ingredients", draft.recipe.ingredients.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>
          <div className="evidence-row"><select aria-label="食材证据" value={item.evidence.kind} onChange={(event) => updateIngredient(index,{evidence:{...item.evidence,kind:event.target.value as ManualEvidence["kind"]}})}>{evidenceOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><input aria-label="证据开始秒" type="number" min="0" step="0.1" value={item.evidence.from ?? ""} onChange={(event) => updateIngredient(index,{evidence:{...item.evidence,from:event.target.value?Number(event.target.value):undefined}})} placeholder="开始秒"/><input aria-label="证据结束秒" type="number" min="0" step="0.1" value={item.evidence.to ?? ""} onChange={(event) => updateIngredient(index,{evidence:{...item.evidence,to:event.target.value?Number(event.target.value):undefined}})} placeholder="结束秒"/><input aria-label="证据备注" value={item.evidence.note ?? ""} onChange={(event) => updateIngredient(index,{evidence:{...item.evidence,note:event.target.value}})} placeholder="画面位置或待核验说明"/></div>
        </div>)}
      </div>

      <div className="panel">
        <div className="section-head"><h2>步骤与证据</h2><button type="button" className="btn btn-secondary" onClick={() => setRecipe("steps", [...draft.recipe.steps, { id: createManualRowId("step"), instruction: "", evidence: { kind: "manual" } }])}>＋ 添加步骤</button></div>
        {draft.recipe.steps.map((step, index) => <div className="manual-array-card" key={step.id}>
          <div className="array-row step-row"><span className="step-no">{index + 1}</span><textarea aria-label={`步骤 ${index + 1}`} value={step.instruction} onChange={(event) => setRecipe("steps", draft.recipe.steps.map((value, stepIndex) => stepIndex === index ? { ...value, instruction: event.target.value } : value))} placeholder="操作、火候和完成判断"/><input aria-label="步骤分钟" type="number" min="0" value={step.minutes ?? ""} onChange={(event) => setRecipe("steps", draft.recipe.steps.map((value, stepIndex) => stepIndex === index ? { ...value, minutes: event.target.value ? Number(event.target.value) : undefined } : value))} placeholder="分钟"/><button type="button" className="icon-btn" aria-label="删除步骤" onClick={() => setRecipe("steps", draft.recipe.steps.filter((_, stepIndex) => stepIndex !== index))}>×</button></div>
          <div className="evidence-row"><select aria-label="步骤证据" value={step.evidence.kind} onChange={(event) => setRecipe("steps", draft.recipe.steps.map((value, stepIndex) => stepIndex === index ? { ...value, evidence: { ...value.evidence, kind: event.target.value as ManualEvidence["kind"] } } : value))}>{evidenceOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><input aria-label="步骤开始秒" type="number" min="0" step="0.1" value={step.evidence.from ?? ""} onChange={(event) => setRecipe("steps", draft.recipe.steps.map((value, stepIndex) => stepIndex === index ? { ...value, evidence: { ...value.evidence, from: event.target.value ? Number(event.target.value) : undefined } } : value))} placeholder="开始秒"/><input aria-label="步骤结束秒" type="number" min="0" step="0.1" value={step.evidence.to ?? ""} onChange={(event) => setRecipe("steps", draft.recipe.steps.map((value, stepIndex) => stepIndex === index ? { ...value, evidence: { ...value.evidence, to: event.target.value ? Number(event.target.value) : undefined } } : value))} placeholder="结束秒"/><input aria-label="步骤证据备注" value={step.evidence.note ?? ""} onChange={(event) => setRecipe("steps", draft.recipe.steps.map((value, stepIndex) => stepIndex === index ? { ...value, evidence: { ...value.evidence, note: event.target.value } } : value))} placeholder="AI 错词或画面补充"/></div>
        </div>)}
      </div>
    </section>

    <aside className="manual-entry-side">
      <div className="panel manual-review-panel" id="manual-review-panel">
        <p className="eyebrow">REVIEW</p><h2>核验与保存</h2>
        <div className="field"><label>当前核验状态</label><select value={draft.review.verificationStatus} onChange={(event) => setDraft((current) => ({ ...current, review: { ...current.review, verificationStatus: event.target.value as ManualRecipeDraft["review"]["verificationStatus"] } }))}><option value="unverified">未核验</option><option value="ai_suggested">AI 建议</option><option value="source_verified">已对照来源</option><option value="user_verified">已人工确认</option></select></div>
        <div className="field" style={{ marginTop: 14 }}><label>核验备注</label><textarea value={draft.review.note} onChange={(event) => setDraft((current) => ({ ...current, review: { ...current.review, note: event.target.value } }))} placeholder="例如：克数来自画面/原网页，仍有字段待核验"/></div>
        <div className="field" style={{ marginTop: 14 }}><label>版本说明</label><textarea value={draft.recipe.versionNote} onChange={(event) => setRecipe("versionNote", event.target.value)}/></div>
        <div className="notice" style={{ marginTop: 16 }}>“存入本机待上传”只建立账号隔离的设备队列，不立即写数据库。之后点击导入中心的“一键上传全部”，每道菜仍会在一次数据库事务中查重并写入来源、菜谱正文和来源版本。</div>
        <div className="notice" style={{marginTop:12}}><b>保存边界：</b>本机队列不会自动同步到其他设备，也不会进入云端备份；上传成功的项目才会从队列移除，失败项目会保留供重试。</div>
        {!currentUserId && <div className="notice" style={{ marginTop: 12, background: "#fbe5de", color: "#923c29" }}>当前登录账号尚未恢复，暂时不能写入账号隔离的本机队列。</div>}
        {error && <div className="notice" role="alert" style={{ marginTop: 12, background: "#fbe5de", color: "#923c29" }}>{error}</div>}
        {message && <div className="notice" role="status" style={{ marginTop: 12, background: "var(--leaf-soft)", color: "var(--leaf)" }}>{message}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving || !currentUserId} style={{ width: "100%", marginTop: 18 }}>{saving ? "正在保存本机队列…" : "存入本机待上传"}</button>
        <button className="btn btn-secondary" type="button" onClick={clearLocalDraft} style={{width:"100%",marginTop:10}}>清空本机草稿</button>
      </div>
    </aside>
  </form>;
}
