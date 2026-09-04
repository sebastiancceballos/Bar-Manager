"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Mínimo 8 caracteres");
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={submit} className="card max-w-md w-full space-y-4 p-6">
        <h1 className="text-xl font-bold text-foreground">Cambiar contraseña</h1>
        <p className="text-sm text-gray-400">
          Debes establecer una contraseña nueva antes de continuar.
        </p>
        {error && (
          <div className="bg-error/10 border border-error text-error text-sm px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div>
          <label className="text-sm">Nueva contraseña</label>
          <input
            type="password"
            className="input w-full mt-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-sm">Confirmar</label>
          <input
            type="password"
            className="input w-full mt-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Guardando..." : "Guardar y continuar"}
        </button>
      </form>
    </div>
  );
}
