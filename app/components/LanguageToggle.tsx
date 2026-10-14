"use client";

import { useI18n } from "@/app/i18n-provider";

/**
 * Botón minimalista ES | EN. Un toque alterna el idioma.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-card/60 p-0.5 text-xs font-semibold ${className}`}
      role="group"
      aria-label={t("language")}
    >
      <button
        type="button"
        onClick={() => setLocale("es")}
        className={`px-2 py-1 rounded-md transition-colors ${
          locale === "es"
            ? "bg-primary text-primary-foreground"
            : "text-gray-400 hover:text-foreground"
        }`}
        aria-pressed={locale === "es"}
      >
        {t("langEs")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`px-2 py-1 rounded-md transition-colors ${
          locale === "en"
            ? "bg-primary text-primary-foreground"
            : "text-gray-400 hover:text-foreground"
        }`}
        aria-pressed={locale === "en"}
      >
        {t("langEn")}
      </button>
    </div>
  );
}
