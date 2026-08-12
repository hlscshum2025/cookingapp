"use client";

import { useEffect } from "react";

const MARKER="data-hold-reveal-ready";
const eyeOpen=`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>`;
const eyeClosed=`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.1 0 9.5 6 9.5 6a15.8 15.8 0 0 1-2.2 2.9"/><path d="M6.3 6.4C3.8 8.1 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`;

export function PasswordPressReveal(){
  useEffect(()=>{
    const enhance=(input:HTMLInputElement)=>{
      if(input.getAttribute(MARKER)==="1")return;
      const parent=input.parentElement;
      if(!parent)return;
      input.setAttribute(MARKER,"1");
      parent.style.position=parent.style.position||"relative";
      input.style.paddingRight="48px";

      const button=document.createElement("button");
      button.type="button";
      button.className="password-hold-eye";
      button.setAttribute("aria-label","按住查看密码");
      button.title="按住查看密码";
      button.innerHTML=eyeClosed;
      Object.assign(button.style,{
        position:"absolute",
        right:"10px",
        width:"34px",
        height:"34px",
        display:"grid",
        placeItems:"center",
        transform:"translateY(-50%)",
        border:"0",
        borderRadius:"9px",
        background:"transparent",
        color:"#6e7b73",
        cursor:"pointer",
        padding:"0",
        zIndex:"2",
        touchAction:"none",
      });

      const align=()=>{button.style.top=`${input.offsetTop+input.offsetHeight/2}px`;};
      const show=()=>{input.type="text";button.innerHTML=eyeOpen;button.style.color="#2f684f";};
      const hide=()=>{input.type="password";button.innerHTML=eyeClosed;button.style.color="#6e7b73";};

      button.addEventListener("pointerdown",event=>{
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        input.focus({preventScroll:true});
        show();
      });
      button.addEventListener("pointerup",hide);
      button.addEventListener("pointercancel",hide);
      button.addEventListener("lostpointercapture",hide);
      button.addEventListener("keydown",event=>{
        if(event.key===" "||event.key==="Enter"){event.preventDefault();show();}
      });
      button.addEventListener("keyup",event=>{
        if(event.key===" "||event.key==="Enter")hide();
      });
      button.addEventListener("blur",hide);

      parent.appendChild(button);
      align();
      const resizeObserver=new ResizeObserver(align);
      resizeObserver.observe(input);
      resizeObserver.observe(parent);
    };

    const scan=()=>document.querySelectorAll<HTMLInputElement>('input[type="password"]:not([data-hold-reveal-ready="1"])').forEach(enhance);
    scan();
    const observer=new MutationObserver(scan);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
