"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage(){
  const params=useSearchParams();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState(params.get("verified")?"邮箱验证完成，现在可以登录。":"");
  const [busy,setBusy]=useState(false);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    const s=getSupabase();
    if(!s){setMessage("当前部署尚未配置 Supabase URL / Publishable key。");return;}
    setBusy(true);setMessage("");
    const {error}=await s.auth.signInWithPassword({email,password});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    location.href="/";
  };

  return <div className="page" style={{maxWidth:680}}>
    <header className="page-head"><div><p className="eyebrow">SIGN IN</p><h1>登录 CookingApp</h1><p className="subtitle">使用已经注册并验证过的邮箱和密码登录。登录不会自动创建新账号。</p></div></header>
    <form className="panel" onSubmit={submit}>
      <div className="field"><label>邮箱地址</label><input required autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></div>
      <div className="field" style={{marginTop:12}}><label>密码</label><input required autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="你的 CookingApp 密码"/></div>
      <button className="btn btn-primary" disabled={busy} style={{width:"100%",marginTop:16}}>{busy?"正在登录…":"登录"}</button>
      {message&&<div className="notice" style={{marginTop:16}}>{message}</div>}
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginTop:16}}><Link href="/register">还没有账号？注册</Link><Link href="/forgot-password">忘记密码</Link></div>
    </form>
  </div>;
}
