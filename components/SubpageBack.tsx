import Link from "next/link";

export function SubpageBack({href,label="返回上一层"}:{href:string;label?:string}){
  return <div className="subpage-back"><Link href={href} className="btn btn-secondary">← {label}</Link></div>;
}
