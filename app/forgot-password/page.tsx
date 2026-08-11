"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function ForgotPasswordPage(){
  const [email,setEmail]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();const s=getSupabase();if(!s){setMessage("Supabase 未配置。");return;}setBusy(true);const {error}=await s.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});setBusy(false);setMessage(error?error.message:"如果这个邮箱对应账号，我们已经发送密码重置邮件。请检查邮箱。");};
  return <div className="page" style={{maxWidth:680}}><header className="page-head"><div><p className="eyebrow">RESET PASSWORD</p><h1>找回密码</h1><p className="subtitle">输入注册邮箱。为了避免泄露“某邮箱是否注册”，页面统一显示相同的成功提示。</p></div></header><form className="panel" onSubmit={submit}><div className="field"><label>邮箱地址</label><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div><button className="btn btn-primary" disabled={busy} style={{width:"100%",marginTop:16}}>{busy?"正在发送…":"发送重置邮件"}</button>{message&&<div className="notice" style={{marginTop:16}}>{message}</div>}<p style={{marginTop:16}}><Link href="/login">返回登录</Link></p></form></div>;
}
