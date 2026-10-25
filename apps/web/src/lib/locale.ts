export const supportedLocales = ["en", "fr", "ar"] as const;

export type Locale = (typeof supportedLocales)[number];
export type TextDirection = "ltr" | "rtl";

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && supportedLocales.some((locale) => locale === value);
}

export function directionForLocale(locale: Locale): TextDirection {
  return locale === "ar" ? "rtl" : "ltr";
}

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 2): string {
  const numberLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.NumberFormat(numberLocale, { maximumFractionDigits }).format(value);
}

function localeFromLanguageTag(value: string): Locale | undefined {
  const language = value.trim().toLowerCase().split(/[-_]/, 1)[0];
  return isLocale(language) ? language : undefined;
}

export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const preferences = (acceptLanguage ?? "").split(",").map((entry, index) => {
    const [rawTag, ...parameters] = entry.trim().split(";");
    const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
    const locale = rawTag && rawTag !== "*" && Number.isFinite(quality) && quality > 0 && quality <= 1
      ? localeFromLanguageTag(rawTag)
      : undefined;
    return { locale, quality, index };
  }).filter((preference): preference is { locale: Locale; quality: number; index: number } => preference.locale !== undefined);
  preferences.sort((left, right) => right.quality - left.quality || left.index - right.index);
  return preferences[0]?.locale ?? "en";
}
