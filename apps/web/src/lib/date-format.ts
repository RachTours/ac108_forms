const formatters = new Map<string, { date: Intl.DateTimeFormat; dateTime: Intl.DateTimeFormat }>();

function getFormatters(locale: string) {
  const formatterLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  const existing = formatters.get(formatterLocale);
  if (existing) return existing;
  const value = {
    date: new Intl.DateTimeFormat(formatterLocale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }),
    dateTime: new Intl.DateTimeFormat(formatterLocale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }),
  };
  formatters.set(formatterLocale, value);
  return value;
}

export function formatDate(value: string | Date, locale = "en-GB"): string {
  return getFormatters(locale).date.format(new Date(value));
}

export function formatDateTime(value: string | Date, locale = "en-GB"): string {
  return `${getFormatters(locale).dateTime.format(new Date(value))} UTC`;
}
