import type {ManualEntryPayload} from "./manual-entry";

export const MANUAL_ENTRY_QUEUE_EVENT="cookingapp:manual-entry-queue-change";
const DATABASE_NAME="cookingapp-local";
const DATABASE_VERSION=1;
const STORE_NAME="manual_recipe_queue";

export type QueuedManualEntry={
  id:string;
  identity:string;
  queuedAt:string;
  updatedAt:string;
  attempts:number;
  lastError:string;
  payload:ManualEntryPayload;
};

type StoredQueuedManualEntry=QueuedManualEntry&{userId:string};

function checkedUserId(userId:string){
  const clean=userId.trim();
  if(!clean)throw new Error("当前登录用户尚未确定，不能保存待上传菜谱。");
  return clean;
}

function createId(){
  return globalThis.crypto?.randomUUID?.()??`queue-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

function entryIdentity(payload:ManualEntryPayload){
  const source=payload.source.externalId||payload.source.url||payload.recipe.id||payload.recipe.title;
  return [payload.source.platform,source,payload.recipe.candidateKey||"main"].join(":").toLocaleLowerCase();
}

function requestResult<T>(request:IDBRequest<T>){
  return new Promise<T>((resolve,reject)=>{
    request.addEventListener("success",()=>resolve(request.result),{once:true});
    request.addEventListener("error",()=>reject(request.error??new Error("本机队列读取失败。")),{once:true});
  });
}

function transactionDone(transaction:IDBTransaction){
  return new Promise<void>((resolve,reject)=>{
    transaction.addEventListener("complete",()=>resolve(),{once:true});
    transaction.addEventListener("abort",()=>reject(transaction.error??new Error("本机队列事务已取消。")),{once:true});
    transaction.addEventListener("error",()=>reject(transaction.error??new Error("本机队列写入失败。")),{once:true});
  });
}

function openQueueDatabase(){
  if(typeof indexedDB==="undefined")return Promise.reject(new Error("当前浏览器不支持 IndexedDB，不能建立批量上传队列。"));
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);
    request.addEventListener("upgradeneeded",()=>{
      const database=request.result;
      const store=database.objectStoreNames.contains(STORE_NAME)
        ?request.transaction!.objectStore(STORE_NAME)
        :database.createObjectStore(STORE_NAME,{keyPath:"id"});
      if(!store.indexNames.contains("user_id"))store.createIndex("user_id","userId",{unique:false});
      if(!store.indexNames.contains("user_identity"))store.createIndex("user_identity",["userId","identity"],{unique:true});
    });
    request.addEventListener("success",()=>resolve(request.result),{once:true});
    request.addEventListener("error",()=>reject(request.error??new Error("无法打开本机菜谱数据库。")),{once:true});
    request.addEventListener("blocked",()=>reject(new Error("本机菜谱数据库正在被旧页面占用，请关闭其他 CookingApp 标签页后重试。")),{once:true});
  });
}

function notify(userId:string,count?:number){
  window.dispatchEvent(new CustomEvent(MANUAL_ENTRY_QUEUE_EVENT,{detail:{userId,count}}));
}

function publicEntry({userId,...entry}:StoredQueuedManualEntry):QueuedManualEntry{
  void userId;
  return entry;
}

export async function listQueuedManualEntries(userId:string){
  const clean=checkedUserId(userId);
  const database=await openQueueDatabase();
  try{
    const transaction=database.transaction(STORE_NAME,"readonly");
    const rows=await requestResult(transaction.objectStore(STORE_NAME).index("user_id").getAll(clean)) as StoredQueuedManualEntry[];
    await transactionDone(transaction);
    return rows.map(publicEntry).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }finally{database.close();}
}

export async function queueManualEntry(userId:string,payload:ManualEntryPayload){
  const clean=checkedUserId(userId);
  const identity=entryIdentity(payload);
  const database=await openQueueDatabase();
  try{
    const transaction=database.transaction(STORE_NAME,"readwrite");
    const store=transaction.objectStore(STORE_NAME);
    const queued=await new Promise<StoredQueuedManualEntry>((resolve,reject)=>{
      const request=store.index("user_identity").get([clean,identity]);
      request.addEventListener("success",()=>{
        const existing=request.result as StoredQueuedManualEntry|undefined;
        const now=new Date().toISOString();
        const next:StoredQueuedManualEntry=existing
          ?{...existing,payload,updatedAt:now,lastError:""}
          :{id:createId(),userId:clean,identity,payload,queuedAt:now,updatedAt:now,attempts:0,lastError:""};
        store.put(next);
        resolve(next);
      },{once:true});
      request.addEventListener("error",()=>reject(request.error??new Error("本机队列查重失败。")),{once:true});
    });
    await transactionDone(transaction);
    notify(clean);
    return publicEntry(queued);
  }finally{database.close();}
}

export async function removeQueuedManualEntry(userId:string,id:string){
  const clean=checkedUserId(userId);
  const database=await openQueueDatabase();
  try{
    const transaction=database.transaction(STORE_NAME,"readwrite");
    const store=transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve,reject)=>{
      const request=store.get(id);
      request.addEventListener("success",()=>{
        const existing=request.result as StoredQueuedManualEntry|undefined;
        if(existing?.userId===clean)store.delete(id);
        resolve();
      },{once:true});
      request.addEventListener("error",()=>reject(request.error??new Error("本机队列项目读取失败。")),{once:true});
    });
    await transactionDone(transaction);
    notify(clean);
  }finally{database.close();}
}

export async function markQueuedManualEntryFailed(userId:string,id:string,error:string){
  const clean=checkedUserId(userId);
  const database=await openQueueDatabase();
  try{
    const transaction=database.transaction(STORE_NAME,"readwrite");
    const store=transaction.objectStore(STORE_NAME);
    await new Promise<void>((resolve,reject)=>{
      const request=store.get(id);
      request.addEventListener("success",()=>{
        const existing=request.result as StoredQueuedManualEntry|undefined;
        if(existing?.userId===clean)store.put({...existing,attempts:existing.attempts+1,lastError:error,updatedAt:new Date().toISOString()});
        resolve();
      },{once:true});
      request.addEventListener("error",()=>reject(request.error??new Error("本机队列项目读取失败。")),{once:true});
    });
    await transactionDone(transaction);
    notify(clean);
  }finally{database.close();}
}
