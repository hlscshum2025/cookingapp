import test from "node:test";
import assert from "node:assert/strict";
import { isLocalDevelopmentHostname } from "../lib/browser-environment.ts";

test("手机通过局域网 IP 打开 Vite 时会识别为开发环境",()=>{
  for(const hostname of ["localhost","127.0.0.1","192.168.1.23","10.0.0.8","172.16.0.4","172.31.255.2","cookingapp.local","[::1]"]){
    assert.equal(isLocalDevelopmentHostname(hostname),true,hostname);
  }
});

test("公网地址和正式域名不会跳过 Turnstile",()=>{
  for(const hostname of ["cookingapp.caoxiaoysm.com","8.8.8.8","172.32.0.1","192.169.1.1","999.1.1.1"]){
    assert.equal(isLocalDevelopmentHostname(hostname),false,hostname);
  }
});
