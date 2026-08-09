import { ManualRecipeEntry } from "@/components/ManualRecipeEntry";

export default function ManualEntryPage() {
  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">MANUAL ENTRY</p><h1>手动录入工作台</h1><p className="subtitle">不等视频自动识别：直接填写来源、字幕、食材、步骤与证据，一次写入 Supabase。</p></div></header>
    <ManualRecipeEntry/>
  </div>;
}
