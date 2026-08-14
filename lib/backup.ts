import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export const BACKUP_TABLES = [
  "profiles",
  "recipes",
  "recipe_versions",
  "cooking_logs",
  "ingredients",
  "source_videos",
  "import_jobs",
  "import_items",
  "tags",
  "recipe_tags",
  "pantry_items",
] as const;

export type BackupTable = typeof BACKUP_TABLES[number];
export type BackupTables = Record<BackupTable, Record<string, unknown>[]>;
export type CookingBackup = {
  schemaVersion: "cookingapp-backup-4";
  exportedAt: string;
  tables: BackupTables;
  storage: { included: false; bucket: string; note: string };
};
export type RestoreMode = "merge" | "replace";
export type RestorePreview = {
  format: "json" | "csv";
  exportedAt?: string;
  totalRows: number;
  counts: Record<BackupTable, number>;
  warnings: string[];
};

const emptyTables=():BackupTables=>Object.fromEntries(BACKUP_TABLES.map(table=>[table,[]])) as BackupTables;
const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);

async function currentUser(s:SupabaseClient){
  const {data:{user},error}=await s.auth.getUser();
  if(error)throw error;
  if(!user)throw new Error("请先登录 CookingApp。");
  return user;
}

export async function getCurrentRole():Promise<"admin"|"user">{
  const s=getSupabase();
  if(!s)return "user";
  const user=await currentUser(s);
  const {data,error}=await s.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(error){
    if(/user_roles/i.test(error.message))return "user";
    throw error;
  }
  return data?.role==="admin"?"admin":"user";
}

async function readOwnedRows(s:SupabaseClient,table:Exclude<BackupTable,"profiles">,userId:string){
  const rows:Record<string,unknown>[]=[];
  const pageSize=1000;
  for(let from=0;;from+=pageSize){
    const {data,error}=await s.from(table).select("*").eq("owner_id",userId).range(from,from+pageSize-1);
    if(error)throw error;
    rows.push(...((data||[]) as Record<string,unknown>[]));
    if((data||[]).length<pageSize)break;
  }
  return rows;
}

export async function createCloudBackup():Promise<CookingBackup>{
  const s=getSupabase();
  if(!s)throw new Error("Supabase 尚未连接。");
  const user=await currentUser(s);
  const {data:profiles,error:profileError}=await s.from("profiles").select("*").eq("id",user.id);
  if(profileError)throw profileError;
  const tables=emptyTables();
  tables.profiles=(profiles||[]) as Record<string,unknown>[];
  for(const table of BACKUP_TABLES){
    if(table==="profiles")continue;
    tables[table]=await readOwnedRows(s,table,user.id);
  }
  return {
    schemaVersion:"cookingapp-backup-4",
    exportedAt:new Date().toISOString(),
    tables,
    storage:{included:false,bucket:"recipe-images",note:"图片文件需从 Supabase Storage 单独备份；业务备份只保存数据库记录与图片路径。"},
  };
}

function csvEscape(value:string){return `"${value.replaceAll('"','""')}"`;}

export function backupToCsv(backup:CookingBackup){
  const lines=["table,row_json"];
  for(const table of BACKUP_TABLES){
    for(const row of backup.tables[table])lines.push(`${csvEscape(table)},${csvEscape(JSON.stringify(row))}`);
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

function parseCsvRows(text:string){
  const source=text.replace(/^\uFEFF/,"");
  const rows:string[][]=[];let row:string[]=[];let field="";let quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(quoted){
      if(char==='"'&&source[i+1]==='"'){field+='"';i++;}
      else if(char==='"')quoted=false;
      else field+=char;
    }else if(char==='"')quoted=true;
    else if(char===","){row.push(field);field="";}
    else if(char==="\n"){row.push(field.replace(/\r$/, ""));rows.push(row);row=[];field="";}
    else field+=char;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  return rows;
}

function normalizeTables(raw:unknown):BackupTables{
  if(!isRecord(raw))throw new Error("备份缺少 tables 对象。");
  const tables=emptyTables();
  for(const table of BACKUP_TABLES){
    const value=raw[table];
    if(value===undefined)continue;
    if(!Array.isArray(value)||value.some(row=>!isRecord(row)))throw new Error(`${table} 数据格式不正确。`);
    tables[table]=value as Record<string,unknown>[];
  }
  return tables;
}

export function parseBackupText(text:string,fileName:string):{backup:CookingBackup;preview:RestorePreview}{
  const format=fileName.toLowerCase().endsWith(".csv")?"csv":"json";
  let backup:CookingBackup;
  if(format==="json"){
    const raw=JSON.parse(text) as Record<string,unknown>;
    if(!isRecord(raw)||!String(raw.schemaVersion||"").startsWith("cookingapp-backup-"))throw new Error("这不是 CookingApp 完整备份文件。");
    backup={schemaVersion:"cookingapp-backup-4",exportedAt:String(raw.exportedAt||""),tables:normalizeTables(raw.tables),storage:{included:false,bucket:"recipe-images",note:"Storage 图片不包含在业务备份中。"}};
  }else{
    const rows=parseCsvRows(text);
    if(rows[0]?.[0]!=="table"||rows[0]?.[1]!=="row_json")throw new Error("CSV 不是 CookingApp 备份包格式。");
    const tables=emptyTables();
    for(const [tableName,rowJson] of rows.slice(1)){
      if(!BACKUP_TABLES.includes(tableName as BackupTable))continue;
      const parsed=JSON.parse(rowJson||"{}");
      if(!isRecord(parsed))throw new Error(`${tableName} 中存在无效记录。`);
      tables[tableName as BackupTable].push(parsed);
    }
    backup={schemaVersion:"cookingapp-backup-4",exportedAt:"",tables,storage:{included:false,bucket:"recipe-images",note:"Storage 图片不包含在业务备份中。"}};
  }
  const counts=Object.fromEntries(BACKUP_TABLES.map(table=>[table,backup.tables[table].length])) as Record<BackupTable,number>;
  const warnings:string[]=[];
  if(!counts.recipes)warnings.push("备份中没有菜谱记录。");
  if(backup.tables.cooking_logs.some(row=>Boolean(row.photo_path)||(isRecord(row.document)&&Boolean(row.document.photoPath))))warnings.push("做菜日志包含图片路径，但图片文件不会由 JSON/CSV 自动恢复。需要单独迁移 Storage。 ");
  return {backup,preview:{format,exportedAt:backup.exportedAt||undefined,totalRows:Object.values(counts).reduce((a,b)=>a+b,0),counts,warnings}};
}

const DELETE_ORDER:Exclude<BackupTable,"profiles">[]=["recipe_tags","import_items","cooking_logs","recipe_versions","tags","import_jobs","source_videos","recipes","ingredients","pantry_items"];
const RESTORE_ORDER:BackupTable[]=["profiles","pantry_items","recipes","ingredients","source_videos","import_jobs","tags","recipe_versions","cooking_logs","import_items","recipe_tags"];

function remapRow(table:BackupTable,row:Record<string,unknown>,userId:string){
  const next={...row};
  delete next.role;
  delete next.user_role;
  if(table==="profiles")next.id=userId;
  else next.owner_id=userId;
  return next;
}

async function clearOwnedData(s:SupabaseClient,userId:string){
  for(const table of DELETE_ORDER){
    const {error}=await s.from(table).delete().eq("owner_id",userId);
    if(error)throw new Error(`清理 ${table} 失败：${error.message}`);
  }
}

export async function restoreCloudBackup(backup:CookingBackup,mode:RestoreMode){
  const s=getSupabase();
  if(!s)throw new Error("Supabase 尚未连接。");
  const user=await currentUser(s);
  const role=await getCurrentRole();
  if(mode==="replace"&&role!=="admin")throw new Error("覆盖式恢复仅管理员可用。普通用户可以使用合并恢复。");
  if(mode==="replace")await clearOwnedData(s,user.id);

  const restored=Object.fromEntries(BACKUP_TABLES.map(table=>[table,0])) as Record<BackupTable,number>;
  for(const table of RESTORE_ORDER){
    const rows=backup.tables[table].map(row=>remapRow(table,row,user.id));
    if(!rows.length)continue;
    const {error}=await s.from(table).upsert(rows);
    if(error)throw new Error(`恢复 ${table} 失败：${error.message}`);
    restored[table]=rows.length;
  }
  return {mode,role,restored,total:Object.values(restored).reduce((a,b)=>a+b,0)};
}
