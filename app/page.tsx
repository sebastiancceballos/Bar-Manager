"use client";

import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setFormError("Email and password are required");
      return;
    }

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setFormError(error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bar Manager
          </h1>
          <p className="text-gray-400">Sistema de gestión </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Correo Electrónico
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
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="input pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {(formError || error) && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
              {formError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>

          <div className="pt-8 border-t border-border/50">
            <p className="text-sm font-medium text-gray-400 mb-4 text-center">Credenciales Demo</p>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => {
                  const emailInput = document.getElementById('email') as HTMLInputElement;
                  const passwordInput = document.getElementById('password') as HTMLInputElement;
                  if (emailInput && passwordInput) {
                    emailInput.value = 'demo@barmanager.com';
                    passwordInput.value = 'demo**';
                  }
                }}
                className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors text-left group"
              >
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Administrador</p>
                  <p className="text-sm text-foreground">demo@barmanager.com</p>
                </div>
                <span className="text-xs text-primary/40 group-hover:text-primary transition-colors italic">Auto-completar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const emailInput = document.getElementById('email') as HTMLInputElement;
                  const passwordInput = document.getElementById('password') as HTMLInputElement;
                  if (emailInput && passwordInput) {
                    emailInput.value = 'MeseroDemo@barmanager.com';
                    passwordInput.value = 'DEMO--';
                  }
                }}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/5 border border-secondary/10 hover:bg-secondary/10 transition-colors text-left group"
              >
                <div>
                  <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">Mesero</p>
                  <p className="text-sm text-foreground">MeseroDemo@barmanager.com</p>
                </div>
                <span className="text-xs text-secondary/40 group-hover:text-secondary transition-colors italic">Auto-completar</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
