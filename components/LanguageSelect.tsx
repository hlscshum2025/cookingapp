"use client";

import { supportedLocales, useLocale } from "@/lib/i18n";

export function LanguageSelect({compact=false}:{compact?:boolean}){
  const {locale,setLocale,localeLabels,t}=useLocale();
  return <label className={compact?"language-select is-compact":"language-select"}>
    {!compact&&<span>{t("language.label")}</span>}
    <select aria-label={t("language.label")} value={locale} onChange={event=>setLocale(event.target.value as typeof locale)}>
      {supportedLocales.map(item=><option key={item} value={item}>{localeLabels[item]}</option>)}
    </select>
  </label>;
}
