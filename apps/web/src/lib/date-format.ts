const formatters = new Map<string, { date: Intl.DateTimeFormat; dateTime: Intl.DateTimeFormat }>();

function getFormatters(locale: string) {
  const existing = formatters.get(locale);
  if (existing) return existing;
  const value = {
    date: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }),
    dateTime: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }),
  };
  formatters.set(locale, value);
  return value;
}

export function formatDate(value: string | Date, locale = "en-GB"): string {
  return getFormatters(locale).date.format(new Date(value));
}

export function formatDateTime(value: string | Date, locale = "en-GB"): string {
  return `${getFormatters(locale).dateTime.format(new Date(value))} UTC`;
}
