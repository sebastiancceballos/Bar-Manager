"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  Locale,
  LOCALES,
  translate,
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === "es" || raw === "en") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

/**
 * Mirrors the locale into a cookie (same name as the localStorage key) so
 * API routes can read the user's language preference without every fetch()
 * call across the app having to send it explicitly. See lib/api-i18n.ts.
 */
function writeLocaleCookie(next: Locale) {
  if (typeof document === "undefined") return;
  try {
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `${LOCALE_STORAGE_KEY}=${next}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored);
    document.documentElement.lang = stored;
    // Make sure the cookie is in sync on first load too (e.g. if it was
    // cleared, or this is a fresh browser profile that only has the
    // localStorage default).
    writeLocaleCookie(stored);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    if (!LOCALES.includes(next)) return;
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    writeLocaleCookie(next);
    document.documentElement.lang = next;
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "es" ? "en" : "es");
  }, [locale, setLocale]);

  const t = useCallback(
    (key: string, fallback?: string) => translate(locale, key, fallback),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
