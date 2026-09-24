"use client";

import { useAuth } from "@/app/providers";
import { useI18n } from "@/app/i18n-provider";
import { LanguageToggle } from "@/app/components/LanguageToggle";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  const { t, locale } = useI18n();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fillDemo = (email: string, password: string) => {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const passwordInput = document.getElementById("password") as HTMLInputElement | null;
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setFormError(t("requiredFields"));
      return;
    }

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch {
      setFormError(error || t("loginFailed"));
    }
  };

  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="card w-full max-w-md relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>

        <div className="mb-8 pr-16">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("appName")}
          </h1>
          <p className="text-gray-400">
            {isEn ? "Bar & restaurant management" : "Sistema de gestión"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              placeholder="admin@barmanager.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              {t("password")}
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="input pr-16"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-foreground transition-colors"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? t("hidePassword") : t("showPassword")}
              </button>
            </div>
          </div>

          {(formError || error) && (
            <div className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {formError || error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? t("loggingIn") : t("login")}
          </button>

          <div className="pt-8 border-t border-border/50">
            <p className="text-sm font-medium text-gray-400 mb-4 text-center">
              {isEn ? "Demo credentials" : "Credenciales demo"}
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => fillDemo("demo@barmanager.com", "demo**")}
                className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors text-left group"
              >
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    {isEn ? "Administrator" : "Administrador"}
                  </p>
                  <p className="text-sm text-foreground">demo@barmanager.com</p>
                </div>
                <span className="text-xs text-primary/40 group-hover:text-primary transition-colors italic">
                  {isEn ? "Autofill" : "Auto-completar"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillDemo("MeseroDemo@barmanager.com", "DEMO--")}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/5 border border-secondary/10 hover:bg-secondary/10 transition-colors text-left group"
              >
                <div>
                  <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">
                    {isEn ? "Waiter" : "Mesero"}
                  </p>
                  <p className="text-sm text-foreground">MeseroDemo@barmanager.com</p>
                </div>
                <span className="text-xs text-secondary/40 group-hover:text-secondary transition-colors italic">
                  {isEn ? "Autofill" : "Auto-completar"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
