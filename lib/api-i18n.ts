import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { translate, DEFAULT_LOCALE, LOCALE_STORAGE_KEY, type Locale } from "@/lib/i18n";

export type ApiParams = Record<string, string | number>;

function isLocale(v: unknown): v is Locale {
  return v === "es" || v === "en";
}

/** Replaces `{name}`-style placeholders in an already translated string. */
export function formatMessage(text: string, params?: ApiParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in params ? String(params[k]) : m
  );
}

/**
 * Resolves the locale for an API request.
 *
 * The client (see app/i18n-provider.tsx) mirrors the user's chosen locale
 * into a cookie named like the localStorage key (LOCALE_STORAGE_KEY), so
 * every request carries it without touching each fetch() call.
 */
export function getApiLocale(request: NextRequest | Request): Locale {
  try {
    const nextReq = request as NextRequest;
    if (nextReq.cookies && typeof nextReq.cookies.get === "function") {
      const value = nextReq.cookies.get(LOCALE_STORAGE_KEY)?.value;
      if (isLocale(value)) return value;
    }
  } catch {
    /* fall through */
  }
  try {
    const header = request.headers.get("cookie") || "";
    const match = header
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${LOCALE_STORAGE_KEY}=`));
    if (match) {
      const value = match.split("=")[1];
      if (isLocale(value)) return value;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

/**
 * Locale from the current request's cookies, for code that has no `request`
 * object at hand (shared services, error helpers). Route handlers only.
 */
export async function getCookieLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const value = store.get(LOCALE_STORAGE_KEY)?.value;
    if (isLocale(value)) return value;
  } catch {
    /* outside a request scope (e.g. cron) */
  }
  return DEFAULT_LOCALE;
}

/**
 * Translates a message key for an API response in the requester's locale.
 *   apiT(request, "apiTableNotFound")
 *   apiT(request, "apiInvalidPaymentMethodUse", { methods: "cash, card" })
 */
export function apiT(
  request: NextRequest | Request,
  key: string,
  params?: ApiParams
): string {
  return formatMessage(translate(getApiLocale(request), key), params);
}

/** Same as apiT but without a request object (uses cookies()). */
export async function apiTAsync(key: string, params?: ApiParams): Promise<string> {
  return formatMessage(translate(await getCookieLocale(), key), params);
}
