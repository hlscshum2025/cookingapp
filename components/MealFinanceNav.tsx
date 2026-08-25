import Link from "next/link";

const modules = [
  { href:"/costs", icon:"€", title:"成本核算", note:"算清一道菜与每人份" },
  { href:"/gatherings", icon:"♟", title:"聚餐协作", note:"点菜、帮厨、采购与 AA" },
  { href:"/ledger", icon:"▤", title:"饮食记账", note:"从小票整理个人饮食支出" },
];

export function MealFinanceNav({active}:{active:"costs"|"gatherings"|"ledger"}){
  return <nav className="meal-finance-nav" aria-label="餐食财务功能">
    {modules.map(module=>{
      const key=module.href.slice(1) as typeof active;
      return <Link key={module.href} href={module.href} className={key===active?"active":""} aria-current={key===active?"page":undefined}>
        <b>{module.icon}</b><span><strong>{module.title}</strong><small>{module.note}</small></span>
      </Link>;
    })}
  </nav>;
}
