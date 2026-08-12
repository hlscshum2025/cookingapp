"use client";

import { useEffect, useMemo, useState } from "react";
import { backupToCsv, createCloudBackup, getCurrentRole, parseBackupText, restoreCloudBackup, type CookingBackup, type RestoreMode, type RestorePreview } from "@/lib/backup";
import { hasPermission, roleLabel, type AppRole } from "@/lib/permissions";
import { useCooking } from "./CookingProvider";

function downloadFile(name:string,content:string,type:string){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function BackupRestorePanel(){
  const {refreshCloudData}=useCooking();
  const [role,setRole]=useState<AppRole>("user");
  const [roleReady,setRoleReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [backup,setBackup]=useState<CookingBackup|null>(null);
  const [preview,setPreview]=useState<RestorePreview|null>(null);
  const [fileName,setFileName]=useState("");
  const [mode,setMode]=useState<RestoreMode>("merge");
  const [confirmText,setConfirmText]=useState("");

  useEffect(()=>{getCurrentRole().then(value=>{setRole(value);setRoleReady(true);}).catch(()=>setRoleReady(true));},[]);
  useEffect(()=>{if(role!=="admin"&&mode==="replace")setMode("merge");},[role,mode]);

  const canReplace=hasPermission(role,"backup.restore_replace_own");
  const counts=useMemo(()=>preview?Object.entries(preview.counts).filter(([,count])=>count>0):[],[preview]);

  const exportBackup=async(format:"json"|"csv")=>{
    setBusy(true);setMessage("");
    try{
      const data=await createCloudBackup();
      const day=new Date().toISOString().slice(0,10);
      if(format==="json")downloadFile(`cookingapp-backup-${day}.json`,JSON.stringify(data,null,2),"application/json");
      else downloadFile(`cookingapp-backup-${day}.csv`,backupToCsv(data),"text/csv;charset=utf-8");
      const total=Object.values(data.tables).reduce((sum,rows)=>sum+rows.length,0);
      setMessage(`已导出 ${total} 条数据库记录。Storage 图片文件不包含在业务备份中。`);
    }catch(error){setMessage(`导出失败：${error instanceof Error?error.message:"未知错误"}`);}finally{setBusy(false);}
  };

  const chooseFile=async(file?:File)=>{
    if(!file)return;
    setMessage("");setBackup(null);setPreview(null);setFileName(file.name);setConfirmText("");
    try{
      const parsed=parseBackupText(await file.text(),file.name);
      setBackup(parsed.backup);setPreview(parsed.preview);
    }catch(error){setMessage(`备份读取失败：${error instanceof Error?error.message:"未知错误"}`);}
  };

  const restore=async()=>{
    if(!backup||!preview)return;
    if(mode==="replace"&&confirmText!=="覆盖恢复"){setMessage("覆盖式恢复前请输入“覆盖恢复”四个字确认。");return;}
    setBusy(true);setMessage("");
    try{
      const result=await restoreCloudBackup(backup,mode);
      await refreshCloudData();
      setMessage(`${mode==="replace"?"覆盖":"合并"}恢复完成：写入 ${result.total} 条记录。当前账号仍保持 ${roleLabel[result.role]} 身份，备份文件不会修改角色。`);
    }catch(error){setMessage(`恢复失败：${error instanceof Error?error.message:"未知错误"}`);}finally{setBusy(false);}
  };

  return <section className="panel">
    <div className="section-head" style={{marginTop:0}}><div><p className="eyebrow">BACKUP & RESTORE</p><h2>JSON / CSV 备份与恢复</h2></div><span className="badge">{roleReady?roleLabel[role]:"正在识别权限"}</span></div>
    <p className="subtitle">完整业务备份覆盖 profiles、菜谱、版本、日志、食材、来源视频、导入审计和标签关系。角色表与 Storage 图片不会写入备份。</p>

    <div className="divider"/>
    <h3>1. 导出当前账号数据</h3>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="btn btn-primary" disabled={busy} onClick={()=>exportBackup("json")}>导出 JSON 完整备份</button><button className="btn btn-secondary" disabled={busy} onClick={()=>exportBackup("csv")}>导出 CSV 备份包</button></div>
    <small style={{display:"block",marginTop:9}}>CSV 采用 `table + row_json` 的可往返格式，可用 Excel 查看；JSON 更适合原样恢复。</small>

    <div className="divider"/>
    <h3>2. 选择备份并预览</h3>
    <div className="dropzone"><b>选择 CookingApp `.json` 或 `.csv` 备份</b><input type="file" accept="application/json,.json,text/csv,.csv" onChange={event=>chooseFile(event.target.files?.[0])}/></div>
    {preview&&<div style={{marginTop:16}}><div className="notice"><b>{fileName}</b><br/>格式：{preview.format.toUpperCase()} · 共 {preview.totalRows} 条记录{preview.exportedAt?` · 导出时间 ${new Date(preview.exportedAt).toLocaleString("zh-CN")}`:""}</div><div className="tag-row" style={{marginTop:10}}>{counts.map(([table,count])=><span className="tag" key={table}>{table} · {count}</span>)}</div>{preview.warnings.map(warning=><div className="notice" key={warning} style={{marginTop:9}}>{warning}</div>)}</div>}

    {preview&&<><div className="divider"/><h3>3. 选择恢复方式</h3><div className="form-grid"><label className="panel" style={{padding:15,cursor:"pointer",boxShadow:"none"}}><input type="radio" name="restore-mode" checked={mode==="merge"} onChange={()=>setMode("merge")}/> <b>合并恢复</b><p className="subtitle">普通用户和管理员都可用。把备份记录归属到当前账号；相同主键会更新，不会主动清空当前数据。</p></label><label className="panel" style={{padding:15,cursor:canReplace?"pointer":"not-allowed",boxShadow:"none",opacity:canReplace?1:.55}}><input type="radio" name="restore-mode" disabled={!canReplace} checked={mode==="replace"} onChange={()=>setMode("replace")}/> <b>覆盖式恢复（管理员）</b><p className="subtitle">先删除当前账号自己的业务数据，再恢复备份。不会删除其他用户数据，也不会改管理员角色。</p></label></div>{mode==="replace"&&<div className="field" style={{marginTop:12}}><label>请输入“覆盖恢复”确认</label><input value={confirmText} onChange={event=>setConfirmText(event.target.value)} placeholder="覆盖恢复"/></div>}<button className="btn btn-primary" style={{marginTop:15}} disabled={busy||!backup||(mode==="replace"&&confirmText!=="覆盖恢复")} onClick={restore}>{busy?"正在处理…":mode==="replace"?"执行覆盖恢复":"执行合并恢复"}</button></>}

    {message&&<div className="notice" style={{marginTop:14}}>{message}</div>}
    <div className="notice" style={{marginTop:14,background:"#f6f1e7"}}><b>权限边界</b><br/>普通用户：管理自己的菜谱/导入、导出自己的备份、合并恢复到自己账号。<br/>管理员：额外拥有覆盖式恢复和后续平台诊断入口，但默认仍不能绕过 RLS 查看其他用户的私密数据。</div>
  </section>;
}
