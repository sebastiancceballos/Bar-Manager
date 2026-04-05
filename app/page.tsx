"use client";

import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

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
          <p className="text-gray-400">Sistema de gestión para bares</p>
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
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              placeholder="••••••••"
              required
            />
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

          <div className="bg-card p-4 rounded-lg text-sm text-gray-400">
            <p className="font-semibold mb-2">Credenciales de demo:</p>
            <p>Admin: admin@barmanager.com / admin123</p>
            <p>Mesero: waiter@barmanager.com / waiter123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
