"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

declare global { interface Window { turnstile?: { render:(el:HTMLElement,opts:Record<string,unknown>)=>string; reset:(id?:string)=>void } } }

export default function RegisterPage(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [captchaToken,setCaptchaToken]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const captchaRef=useRef<HTMLDivElement|null>(null);
  const widgetId=useRef<string|undefined>(undefined);
  const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderCaptcha=()=>{
    if(!siteKey||!captchaRef.current||!window.turnstile||widgetId.current)return;
    widgetId.current=window.turnstile.render(captchaRef.current,{sitekey:siteKey,callback:(token:string)=>setCaptchaToken(token),"expired-callback":()=>setCaptchaToken(""),"error-callback":()=>setCaptchaToken("")});
  };
  useEffect(()=>{renderCaptcha();},[siteKey]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setMessage("");
    if(password.length<10){setMessage("密码至少需要 10 个字符。");return;}
    if(password!==confirmPassword){setMessage("两次输入的密码不一致。");return;}
    if(siteKey&&!captchaToken){setMessage("请先完成人机验证。");return;}
    const s=getSupabase();if(!s){setMessage("当前部署尚未配置 Supabase。");return;}
    setBusy(true);
    const {data,error}=await s.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/login?verified=1`,...(captchaToken?{captchaToken}:{})}});
    setBusy(false);
    if(widgetId.current&&window.turnstile){window.turnstile.reset(widgetId.current);setCaptchaToken("");}
    if(error){setMessage(error.message);return;}
    if(data.session){location.href="/";return;}
    setMessage("注册申请已提交。请打开验证邮件并完成邮箱验证，再回来登录。");
  };

  return <div className="page" style={{maxWidth:680}}>
    {siteKey&&<Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={renderCaptcha}/>}
    <header className="page-head"><div><p className="eyebrow">CREATE ACCOUNT</p><h1>注册 CookingApp</h1><p className="subtitle">每个账号都有独立菜谱空间。注册后需要验证邮箱，别人不能读取或修改你的私人数据。</p></div></header>
    <form className="panel" onSubmit={submit}>
      <div className="field"><label>邮箱地址</label><input required autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
      <div className="field" style={{marginTop:12}}><label>密码</label><input required minLength={10} autoComplete="new-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /><small>至少 10 个字符；建议使用密码管理器生成独立密码。</small></div>
      <div className="field" style={{marginTop:12}}><label>确认密码</label><input required minLength={10} autoComplete="new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></div>
      {siteKey?<div ref={captchaRef} style={{marginTop:16}}/>:<div className="notice" style={{marginTop:16}}>当前部署尚未配置 Turnstile Site Key。开发环境可继续测试，但正式开放注册前必须配置。</div>}
      <button className="btn btn-primary" disabled={busy} style={{width:"100%",marginTop:16}}>{busy?"正在创建账号…":"注册"}</button>
      {message&&<div className="notice" style={{marginTop:16}}>{message}</div>}
      <p style={{marginTop:16}}>已经有账号？<Link href="/login">去登录</Link></p>
    </form>
  </div>;
}
