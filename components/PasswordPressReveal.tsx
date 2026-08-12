"use client";

import { useEffect } from "react";

const MARKER="data-hold-reveal-ready";

export function PasswordPressReveal(){
  useEffect(()=>{
    const enhance=(input:HTMLInputElement)=>{
      if(input.getAttribute(MARKER)==="1")return;
      input.setAttribute(MARKER,"1");
      const parent=input.parentElement;
      if(!parent)return;
      parent.style.position=parent.style.position||"relative";
      input.style.paddingRight="46px";
      const button=document.createElement("button");
      button.type="button";
      button.setAttribute("aria-label","按住查看密码");
      button.title="按住查看密码";
      button.textContent="◉";
      Object.assign(button.style,{
        position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)",
        border:"0",background:"transparent",cursor:"pointer",fontSize:"18px",lineHeight:"1",
        padding:"6px",opacity:"0.68",zIndex:"2",touchAction:"none",
      });
      const show=()=>{input.type="text";button.style.opacity="1";};
      const hide=()=>{input.type="password";button.style.opacity="0.68";};
      button.addEventListener("pointerdown",event=>{
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        show();
      });
      button.addEventListener("pointerup",hide);
      button.addEventListener("pointercancel",hide);
      button.addEventListener("lostpointercapture",hide);
      button.addEventListener("blur",hide);
      parent.appendChild(button);
    };
    const scan=()=>document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(enhance);
    scan();
    const observer=new MutationObserver(scan);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
