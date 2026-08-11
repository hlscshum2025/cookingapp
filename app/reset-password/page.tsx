"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function ResetPasswordPage(){
  const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(password.length<10){setMessage("密码至少需要 10 个字符。");return;}if(password!==confirm){setMessage("两次密码不一致。");return;}const s=getSupabase();if(!s){setMessage("Supabase 未配置。");return;}setBusy(true);const {error}=await s.auth.updateUser({password});setBusy(false);if(error){setMessage(error.message);return;}setMessage("密码已经更新。你可以返回登录页使用新密码登录。");};
  return <div className="page" style={{maxWidth:680}}><header className="page-head"><div><p className="eyebrow">NEW PASSWORD</p><h1>设置新密码</h1></div></header><form className="panel" onSubmit={submit}><div className="field"><label>新密码</label><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="field" style={{marginTop:12}}><label>确认新密码</label><input required minLength={10} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></div><button className="btn btn-primary" disabled={busy} style={{width:"100%",marginTop:16}}>{busy?"正在更新…":"更新密码"}</button>{message&&<div className="notice" style={{marginTop:16}}>{message}</div>}<p style={{marginTop:16}}><Link href="/login">返回登录</Link></p></form></div>;
}
