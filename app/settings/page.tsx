"use client";

import { useState } from "react";
import { BackupRestorePanel } from "@/components/BackupRestorePanel";
import { useCooking } from "@/components/CookingProvider";
import { connectSupabase } from "@/lib/supabase";
import { FeedbackAdminPanel } from "@/components/FeedbackAdminPanel";
import { useLocale } from "@/lib/i18n";

export default function SettingsPage(){
  const {isDemo,cloudStatus,cloudError,currentUserEmail,lastCloudSync,refreshCloudData,resetDemo}=useCooking();
  const {t}=useLocale();
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [passwordInfo,setPasswordInfo]=useState("");
  const [passwordBusy,setPasswordBusy]=useState(false);
  const [connectionInfo,setConnectionInfo]=useState("");
  const [connectionBusy,setConnectionBusy]=useState(false);

  const savePassword=async(e:React.FormEvent)=>{
    e.preventDefault();setPasswordInfo("");
    if(newPassword.length<12){setPasswordInfo("密码至少需要12个字符。");return;}
    if(newPassword!==confirmPassword){setPasswordInfo("两次输入的密码不一致。");return;}
    setPasswordBusy(true);
    try{
      const s=await connectSupabase();
      if(!s){setPasswordInfo("当前站点尚未读取到 Supabase 配置，请稍后重试。");return;}
      const {error}=await s.auth.updateUser({password:newPassword});
      setPasswordInfo(error?error.message:"登录密码已设置。以后可直接使用账号邮箱和密码登录。");
      if(!error){setNewPassword("");setConfirmPassword("");}
    }catch{setPasswordInfo("保存密码时连接失败，请稍后重试。");}
    finally{setPasswordBusy(false);}
  };

  const reconnect=async()=>{
    setConnectionBusy(true);setConnectionInfo("");
    try{await refreshCloudData();setConnectionInfo("连接成功，云端数据已重新同步。");}
    catch(error){setConnectionInfo(error instanceof Error?error.message:"重新连接失败，请检查手机 VPN 和网络。");}
    finally{setConnectionBusy(false);}
  };

  const configLabel=cloudStatus==="unconfigured"?"站点配置不可用":cloudStatus==="loading"?"正在连接 / 同步":cloudStatus==="connected"?"已连接":cloudStatus==="error"?"未连接":"等待登录";
  const connectionButton=cloudStatus==="connected"?"立即同步":cloudStatus==="unconfigured"?"重新读取配置":"重新连接";
  const lastSyncLabel=lastCloudSync?new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(lastCloudSync)):"尚未完成";

  return <div className="page">
    <header className="page-head"><div><p className="eyebrow">{t("settings.eyebrow")}</p><h1>{t("settings.title")}</h1><p className="subtitle">{t("settings.subtitle")}</p></div></header>
    <div className="two-col">
      <section className="panel">
        <h2>账号与数据库</h2>
        <div className="stats settings-account-stats"><div className={`stat environment-status ${cloudStatus==="connected"?"is-connected":""}`}><div className="stat-label">Supabase 状态</div><div style={{fontWeight:800}}>{configLabel}</div></div><div className="stat"><div className="stat-label">登录用户</div><div style={{fontWeight:800,wordBreak:"break-all"}}>{currentUserEmail||"未登录"}</div></div><div className="stat"><div className="stat-label">最近同步</div><div style={{fontWeight:800}}>{lastSyncLabel}</div></div></div>
        <div className="connection-actions"><div className="notice"><b>{cloudStatus==="loading"?"正在等待 Supabase 响应。":cloudStatus==="error"?"最近一次连接失败；页面会保留并显示上次同步的数据。":"连接状态不会因为正常切换页面而主动重置。"}</b><br/>手机访问本机页面时，Supabase 请求由手机浏览器直接发出；如所在网络需要 VPN，请确认浏览器已被 VPN 接管。</div><button className="btn btn-secondary" type="button" disabled={connectionBusy||cloudStatus==="loading"||cloudStatus==="signed_out"} onClick={()=>void reconnect()}>{connectionBusy||cloudStatus==="loading"?"正在连接…":connectionButton}</button></div>
        {cloudError&&<div className="notice" style={{background:"#fbe5de",color:"#923c29"}}>云端同步提示：{cloudError}</div>}
        {connectionInfo&&<div className="notice" role="status" style={{marginTop:9}}>{connectionInfo}</div>}
        <form className="auth-form password-panel" onSubmit={savePassword}><div><h3>设置账号登录密码</h3><p className="subtitle">为当前账号创建或更换密码。至少12个字符，密码不会保存到网页代码中。</p></div><div className="form-grid"><div className="field"><label>新密码</label><input required minLength={12} type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></div><div className="field"><label>再次输入新密码</label><input required minLength={12} type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></div></div><button className="btn btn-primary" disabled={passwordBusy}>{passwordBusy?"正在保存…":"保存登录密码"}</button>{passwordInfo&&<div className="notice">{passwordInfo}</div>}</form>
        <button className="btn btn-secondary" style={{marginTop:15}} onClick={async()=>{const s=await connectSupabase();await s?.auth.signOut();location.assign("/login")}}>退出登录</button>
        {isDemo&&<button className="btn btn-danger" style={{marginTop:9}} onClick={()=>{if(confirm("确定恢复演示数据吗？本机当前演示修改会被覆盖。"))resetDemo()}}>恢复演示数据</button>}
      </section>
      <aside className="panel"><h2>账号权限怎么理解</h2><p className="subtitle">普通用户和管理员都只能通过 RLS 读写自己的私人业务数据。管理员身份不会自动获得其他用户私人菜谱的读取权。</p><div className="notice" style={{marginTop:14}}><b>普通用户</b><br/>自己的菜谱、来源、日志、食材、导入、备份与合并恢复。</div><div className="notice" style={{marginTop:9,background:"var(--leaf-soft)",color:"var(--leaf)"}}><b>管理员</b><br/>在普通用户能力之上增加覆盖式恢复和后续平台诊断/运营入口。角色不能由前端自行修改。</div><details className="settings-backup"><summary>数据备份与恢复 <span>展开</span></summary><div className="settings-backup-content"><BackupRestorePanel/></div></details></aside>
    </div>
    <div style={{marginTop:20}}><FeedbackAdminPanel/></div>
  </div>;
}
