import type { Locale } from "@/lib/i18n";

/**
 * Date/time formatting that follows the UI language.
 * Spanish uses es-CO (the business operates in Colombia), English uses en-US.
 * Currency formatting is intentionally NOT localized: amounts are always COP.
 */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "es-CO";
}

type DateInput = string | number | Date;

const toDate = (v: DateInput) => (v instanceof Date ? v : new Date(v));

export function fmtDate(
  value: DateInput,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleDateString(intlLocale(locale), options);
}

export function fmtTime(
  value: DateInput,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleTimeString(intlLocale(locale), options);
}

export function fmtDateTime(
  value: DateInput,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleString(intlLocale(locale), options);
}

/**
 * For "YYYY-MM-DD" strings (no time). Built from local parts so the browser
 * time zone can't shift the day (new Date("2026-07-18") is UTC midnight and
 * would show the previous day in Bogotá).
 */
export function fmtDateOnly(dateStr: string, locale: Locale): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return fmtDate(dateStr, locale);
  const [, y, m, d] = match;
  return fmtDate(new Date(parseInt(y), parseInt(m) - 1, parseInt(d)), locale);
}
