"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage(){const [email,setEmail]=useState("");const [message,setMessage]=useState("");const submit=async(e:React.FormEvent)=>{e.preventDefault();const s=getSupabase();if(!s){setMessage("请先在 .env.local 中填写 Supabase URL 和 publishable key。");return;}const {error}=await s.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});setMessage(error?error.message:"登录链接已经发送到邮箱，请在同一浏览器中打开。")};return <div className="page" style={{maxWidth:620}}><header className="page-head"><div><p className="eyebrow">SIGN IN</p><h1>登录管理端</h1><p className="subtitle">通过 Supabase 邮箱魔法链接登录，不需要单独记密码。</p></div></header><form className="panel" onSubmit={submit}><div className="field"><label>邮箱地址</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></div><button className="btn btn-primary" style={{width:"100%",marginTop:16}}>发送登录链接</button>{message&&<div className="notice" style={{marginTop:16}}>{message}</div>}</form></div>}
