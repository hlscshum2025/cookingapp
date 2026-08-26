const modules = [
  { key:"costs", icon:"€", title:"成本核算", note:"算清一道菜与每人份" },
  { key:"gatherings", icon:"♟", title:"聚餐协作", note:"点菜、帮厨、采购与 AA" },
  { key:"ledger", icon:"▤", title:"饮食记账", note:"从小票整理个人饮食支出" },
];

export type MealFinanceModule="costs"|"gatherings"|"ledger";

export function MealFinanceNav({active,onSelect}:{active:MealFinanceModule;onSelect:(module:MealFinanceModule)=>void}){
  return <nav className="meal-finance-nav" aria-label="餐食财务功能">
    {modules.map(module=>{
      const key=module.key as MealFinanceModule;
      return <button type="button" key={key} className={key===active?"active":""} aria-pressed={key===active} onClick={()=>onSelect(key)}>
        <b>{module.icon}</b><span><strong>{module.title}</strong><small>{module.note}</small></span>
      </button>;
    })}
  </nav>;
}
