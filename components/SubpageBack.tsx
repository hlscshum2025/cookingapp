import Link from "next/link";

export function SubpageBack({href,label="返回上一层"}:{href:string;label?:string}){
  return <div style={{display:"flex",justifyContent:"flex-start",alignItems:"center",margin:"-8px 0 24px",padding:"0 2px"}}><Link href={href} className="btn btn-secondary" style={{padding:"9px 13px"}}>← {label}</Link></div>;
}
