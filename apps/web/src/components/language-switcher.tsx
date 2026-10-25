"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronDown, Languages } from "lucide-react";
import type { Locale } from "../lib/locale";

const choices: { value: Locale; labelKey: "english" | "french" | "arabic" }[] = [
  { value: "en", labelKey: "english" },
  { value: "fr", labelKey: "french" },
  { value: "ar", labelKey: "arabic" },
];

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("language");
  const router = useRouter();

  function changeLanguage(nextLocale: Locale) {
    if (nextLocale === locale) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `rr_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  }

  return <label className="language-switcher">
    <Languages size={16} aria-hidden="true" />
    <span className="sr-only">{t("label")}</span>
    <select aria-label={t("label")} value={locale} onChange={(event) => changeLanguage(event.target.value as Locale)}>
      {choices.map(({ value, labelKey }) => <option key={value} value={value}>{t(labelKey)}</option>)}
    </select>
    <ChevronDown className="language-chevron" size={14} aria-hidden="true" />
  </label>;
}
