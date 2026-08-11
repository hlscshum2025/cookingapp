"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { connectSupabase, getTurnstileSiteKey } from "@/lib/supabase";

declare global {
  interface Window {
    turnstile?: {
      render:(element:HTMLElement,options:Record<string,unknown>)=>string;
      reset:(widgetId?:string)=>void;
      remove?:(widgetId:string)=>void;
    };
  }
}

function safeNext(){
  const value=new URLSearchParams(window.location.search).get("next")||"/";
  return value.startsWith("/")&&!value.startsWith("//")?value:"/";
}

export default function LoginPage(){
  const router=useRouter();
  const searchParams=useSearchParams();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [signupPassword,setSignupPassword]=useState("");
  const [signupConfirmation,setSignupConfirmation]=useState("");
  const [selectedMode,setSelectedMode]=useState<"login"|"signup"|"confirm"|"forgot">("login");
  const mode=searchParams.get("mode")==="recovery"?"recovery":selectedMode;
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [turnstileSiteKey,setTurnstileSiteKey]=useState<string|null>(null);
  const [turnstileChecked,setTurnstileChecked]=useState(false);
  const [captchaToken,setCaptchaToken]=useState("");
  const captchaRef=useRef<HTMLDivElement|null>(null);
  const widgetId=useRef<string|undefined>(undefined);
  const widgetMode=useRef<string|undefined>(undefined);
  const [resendCountdown,setResendCountdown]=useState(0);

  const renderCaptcha=useCallback(()=>{
    if(mode==="recovery"||!turnstileSiteKey||!captchaRef.current||!window.turnstile)return;
    if(widgetId.current&&widgetMode.current!==mode){window.turnstile.remove?.(widgetId.current);widgetId.current=undefined;setCaptchaToken("");}
    if(widgetId.current)return;
    widgetId.current=window.turnstile.render(captchaRef.current,{
      sitekey:turnstileSiteKey,
      callback:(token:string)=>setCaptchaToken(token),
      "expired-callback":()=>setCaptchaToken(""),
      "error-callback":()=>setCaptchaToken(""),
    });
    widgetMode.current=mode;
  },[mode,turnstileSiteKey]);

  useEffect(()=>{
    getTurnstileSiteKey().then(key=>{setTurnstileSiteKey(key);setTurnstileChecked(true);});
  },[]);
  useEffect(()=>{
    if(mode!=="recovery")renderCaptcha();
    else if(widgetId.current){window.turnstile?.remove?.(widgetId.current);widgetId.current=undefined;widgetMode.current=undefined;setCaptchaToken("");}
  },[mode,renderCaptcha]);
  useEffect(()=>{
    if(resendCountdown<=0)return;
    const timer=window.setInterval(()=>setResendCountdown(value=>Math.max(0,value-1)),1000);
    return()=>window.clearInterval(timer);
  },[resendCountdown]);

  const resetCaptcha=()=>{
    if(widgetId.current&&window.turnstile){window.turnstile.reset(widgetId.current);setCaptchaToken("");}
  };
  const friendlyMailError=(error:{message:string;status?:number;code?:string}|null,action:"注册"|"重发"|"找回")=>{
    if(!error)return "";
    if(error.status===429||error.code==="over_email_send_rate_limit"||/rate limit/i.test(error.message))return "邮件发送次数已达到 Supabase 当前限额，请稍后再试；正式开放多人注册前需要配置自定义 SMTP。";
    if(/captcha/i.test(error.message))return "人机验证已过期，请重新勾选后再试。";
    if(/signups not allowed/i.test(error.message))return "注册通道暂未开放，请稍后再试。";
    return `${action}邮件暂时无法发送，请稍后再试。`;
  };

  const signIn=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setMessage("");
    if(!turnstileSiteKey||!captchaToken){setMessage("请先完成人机验证。");setBusy(false);return;}
    const s=await connectSupabase();
    if(!s){setMessage("当前站点尚未读取到 Supabase 配置，请稍后重试。");setBusy(false);return;}
    const {error}=await s.auth.signInWithPassword({email,password,options:{captchaToken}});
    resetCaptcha();
    if(error){setMessage("账号邮箱或密码不正确。没有账号可以先注册；忘记密码可使用下方的找回入口。");setBusy(false);return;}
    router.replace(safeNext());
  };

  const sendRecovery=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setMessage("");
    if(!turnstileSiteKey||!captchaToken){setMessage("请先完成人机验证。");setBusy(false);return;}
    const s=await connectSupabase();
    if(!s){setMessage("当前站点尚未读取到 Supabase 配置，请稍后重试。");setBusy(false);return;}
    // The production origin is already allowlisted in Supabase. The provider
    // turns the PASSWORD_RECOVERY event into the local password form route.
    const {error}=await s.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin,captchaToken});
    resetCaptcha();
    setMessage(error?friendlyMailError(error,"找回"):"如果这是已登记的账号邮箱，密码重置邮件会发送到该邮箱。请打开最新邮件中的链接。");
    setBusy(false);
  };

  const signUp=async(e:React.FormEvent)=>{
    e.preventDefault();setMessage("");
    if(signupPassword.length<12){setMessage("密码至少需要12个字符。");return;}
    if(signupPassword!==signupConfirmation){setMessage("两次输入的密码不一致。");return;}
    if(!turnstileSiteKey){setMessage("注册保护尚未完成配置，请稍后再试。");return;}
    if(!captchaToken){setMessage("请先完成人机验证。");return;}
    setBusy(true);
    try{
      const s=await connectSupabase();
      if(!s){setMessage("当前站点尚未读取到 Supabase 配置，请稍后重试。");return;}
      const {data,error}=await s.auth.signUp({
        email,
        password:signupPassword,
        options:{emailRedirectTo:window.location.origin,captchaToken},
      });
      if(error){
        setMessage(friendlyMailError(error,"注册"));
        return;
      }
      setMessage(data.session
        ? "账号创建成功，正在进入 CookingApp…"
        : "注册确认邮件已发送。请打开最新邮件完成验证，再返回 CookingApp 登录。");
      if(data.session)router.replace("/");
      else {setSelectedMode("confirm");setResendCountdown(60);}
    }catch{
      setMessage("注册时连接失败，请稍后重试。");
    }finally{
      resetCaptcha();
      setBusy(false);
    }
  };

  const resendSignupConfirmation=async(e:React.FormEvent)=>{
    e.preventDefault();setMessage("");
    if(resendCountdown>0){setMessage(`请等待 ${resendCountdown} 秒后再重新发送。`);return;}
    if(!captchaToken){setMessage("请先完成人机验证。");return;}
    setBusy(true);
    try{
      const s=await connectSupabase();
      if(!s){setMessage("当前站点尚未读取到 Supabase 配置，请稍后重试。");return;}
      const {error}=await s.auth.resend({type:"signup",email,options:{emailRedirectTo:window.location.origin,captchaToken}});
      setMessage(error?friendlyMailError(error,"重发"):"注册确认邮件已重新发送。请检查收件箱和垃圾邮件；同一邮箱至少间隔60秒再试。");
      if(!error)setResendCountdown(60);
    }catch{
      setMessage("重新发送时连接失败，请稍后再试。");
    }finally{
      resetCaptcha();
      setBusy(false);
    }
  };

  const saveRecoveredPassword=async(e:React.FormEvent)=>{
    e.preventDefault();setMessage("");
    if(newPassword.length<12){setMessage("密码至少需要12个字符。");return;}
    if(newPassword!==confirmPassword){setMessage("两次输入的密码不一致。");return;}
    setBusy(true);
    try{
      const s=await connectSupabase();
      if(!s){setMessage("当前站点尚未读取到 Supabase 配置，请稍后重试。");return;}
      const {data}=await s.auth.getSession();
      if(!data.session){setMessage("密码设置链接已失效，请重新发送邮件。");return;}
      const {error}=await s.auth.updateUser({password:newPassword});
      if(error){setMessage(error.message);return;}
      setMessage("密码设置成功，正在进入 CookingApp…");
      router.replace("/");
    }catch{
      setMessage("保存密码时连接失败，请稍后重试。");
    }finally{
      setBusy(false);
    }
  };

  const captchaBox=mode==="recovery"?null:turnstileSiteKey
    ?<div ref={captchaRef}/>
    :turnstileChecked
      ?<div className="notice">账号保护尚未完成配置，当前不能提交。</div>
      :<div className="notice">正在加载账号保护…</div>;

  return <div className="auth-page">
    {turnstileSiteKey&&<Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={renderCaptcha}/>}
    <div className="auth-card">
      <div className="auth-brand"><span className="brand-mark">♨</span><span><strong>CookingApp</strong><small>我的做菜知识库</small></span></div>
      {mode==="login"&&<>
        <p className="eyebrow">WELCOME BACK</p><h1>登录 CookingApp</h1>
        <p className="subtitle">使用你的 CookingApp 账号邮箱和密码。这里不需要 ChatGPT、GitHub 或 Supabase Dashboard 账号。</p>
        <form onSubmit={signIn} className="auth-form">
          <div className="field"><label>账号邮箱</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="username"/></div>
          <div className="field"><label>密码</label><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></div>
          {captchaBox}
          <button disabled={busy||!turnstileSiteKey||!captchaToken} className="btn btn-primary">{busy?"正在登录…":"登录 CookingApp"}</button>
        </form>
        <button className="btn btn-secondary auth-register-action" onClick={()=>{setSelectedMode("signup");setMessage("")}}>没有账号？注册新账号</button>
        <button className="auth-link auth-link-secondary" onClick={()=>{setSelectedMode("confirm");setMessage("")}}>注册后没收到确认邮件？</button>
        <button className="auth-link auth-link-tertiary" onClick={()=>{setSelectedMode("forgot");setMessage("")}}>忘记密码？</button>
        <small className="admin-signin-note">管理者也从此处登录</small>
      </>}
      {mode==="signup"&&<>
        <p className="eyebrow">CREATE ACCOUNT</p><h1>创建个人账号</h1>
        <p className="subtitle">每个账号拥有独立的菜谱、食材、导入记录和做菜日志，其他用户无法查看或修改。</p>
        <form onSubmit={signUp} className="auth-form">
          <div className="field"><label>邮箱</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></div>
          <div className="field"><label>密码</label><input required minLength={12} type="password" value={signupPassword} onChange={e=>setSignupPassword(e.target.value)} autoComplete="new-password"/><small>至少12个字符，建议使用密码管理器保存。</small></div>
          <div className="field"><label>再次输入密码</label><input required minLength={12} type="password" value={signupConfirmation} onChange={e=>setSignupConfirmation(e.target.value)} autoComplete="new-password"/></div>
          {captchaBox}
          <button disabled={busy||!turnstileSiteKey||!captchaToken} className="btn btn-primary">{busy?"正在创建…":"创建账号"}</button>
        </form>
        <div className="notice signup-privacy-note"><b>数据默认私密</b><br/>新账号只会看到自己的空白知识库，不会看到管理者的14道菜。</div>
        <button className="auth-link auth-link-secondary" onClick={()=>{setSelectedMode("login");setMessage("")}}>已有账号？返回登录</button>
      </>}
      {mode==="confirm"&&<>
        <p className="eyebrow">CONFIRM EMAIL</p><h1>重新发送注册确认邮件</h1>
        <p className="subtitle">这里只处理新账号的邮箱确认，不会进入密码找回流程。邮件可能进入垃圾邮件；Supabase 默认邮件服务每小时额度很低。</p>
        <form onSubmit={resendSignupConfirmation} className="auth-form">
          <div className="field"><label>注册邮箱</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div>
          {captchaBox}
          <button disabled={busy||!turnstileSiteKey||!captchaToken||resendCountdown>0} className="btn btn-primary">{busy?"正在发送…":resendCountdown>0?`${resendCountdown} 秒后可重发`:"重新发送注册确认邮件"}</button>
        </form>
        <button className="auth-link" onClick={()=>{setSelectedMode("login");setMessage("")}}>确认完成后返回登录</button>
      </>}
      {mode==="forgot"&&<>
        <p className="eyebrow">PASSWORD RECOVERY</p><h1>找回密码</h1>
        <p className="subtitle">输入已注册的 CookingApp 账号邮箱。这里发送密码重置邮件，不用于新账号注册确认。</p>
        <form onSubmit={sendRecovery} className="auth-form">
          <div className="field"><label>账号邮箱</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div>
          {captchaBox}
          <button disabled={busy||!turnstileSiteKey||!captchaToken} className="btn btn-primary">{busy?"正在发送…":"发送密码重置邮件"}</button>
        </form>
        <button className="auth-link" onClick={()=>{setSelectedMode("login");setMessage("")}}>返回账号密码登录</button>
      </>}
      {mode==="recovery"&&<>
        <p className="eyebrow">NEW PASSWORD</p><h1>创建新密码</h1>
        <p className="subtitle">密码至少12个字符，建议使用密码管理器生成并保存。</p>
        <form onSubmit={saveRecoveredPassword} className="auth-form">
          <div className="field"><label>新密码</label><input required minLength={12} type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></div>
          <div className="field"><label>再次输入新密码</label><input required minLength={12} type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></div>
          <button disabled={busy} className="btn btn-primary">{busy?"正在保存…":"保存密码并登录"}</button>
        </form>
      </>}
      {message&&<div className="notice auth-message">{message}</div>}
    </div>
  </div>;
}
