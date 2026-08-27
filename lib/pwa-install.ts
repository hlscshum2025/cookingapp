export type PwaInstallPrompt={
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};

let deferredPrompt:PwaInstallPrompt|null=null;
const listeners=new Set<()=>void>();

function notify(){listeners.forEach(listener=>listener());}

export function rememberPwaInstallPrompt(prompt:PwaInstallPrompt){
  deferredPrompt=prompt;
  notify();
}

export function clearPwaInstallPrompt(){
  deferredPrompt=null;
  notify();
}

export function hasPwaInstallPrompt(){return Boolean(deferredPrompt);}

export function subscribePwaInstallPrompt(listener:()=>void){
  listeners.add(listener);
  return()=>listeners.delete(listener);
}

export async function requestPwaInstall(){
  const prompt=deferredPrompt;
  if(!prompt)return false;
  await prompt.prompt();
  const choice=await prompt.userChoice;
  clearPwaInstallPrompt();
  return choice.outcome==="accepted";
}

