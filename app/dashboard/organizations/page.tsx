"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Org = {
  id: number;
  name: string;
  status: string;
  location_count?: number;
  admin_count?: number;
  created_at?: string;
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barForm, setBarForm] = useState({ name: "", address: "", organizationId: "" });

  useEffect(() => {
    if (user && user.role !== "owner") router.push("/dashboard");
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setOrgs(data.organizations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "owner") load();
  }, [user, load]);

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear");
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const createBar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: barForm.name,
          address: barForm.address,
          organizationId: barForm.organizationId
            ? parseInt(barForm.organizationId, 10)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear sucursal");
      setBarForm({ name: "", address: "", organizationId: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "owner") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Redirigiendo...
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Organizaciones</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Un cliente de la plataforma puede tener varias sucursales. Primero crea la
              organización, luego las sucursales asociadas.
            </p>
          </div>

          {error && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={createOrg} className="card space-y-3">
            <h2 className="font-semibold text-lg">Nueva organización</h2>
            <input
              className="input w-full"
              placeholder="Nombre del negocio / cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? "Guardando..." : "Crear organización"}
            </button>
          </form>

          <form onSubmit={createBar} className="card space-y-3">
            <h2 className="font-semibold text-lg">Nueva sucursal</h2>
            <select
              className="input w-full"
              value={barForm.organizationId}
              onChange={(e) => setBarForm({ ...barForm, organizationId: e.target.value })}
              required
            >
              <option value="">Selecciona organización</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input
              className="input w-full"
              placeholder="Nombre de la sucursal"
              value={barForm.name}
              onChange={(e) => setBarForm({ ...barForm, name: e.target.value })}
              required
            />
            <input
              className="input w-full"
              placeholder="Dirección"
              value={barForm.address}
              onChange={(e) => setBarForm({ ...barForm, address: e.target.value })}
              required
            />
            <button type="submit" disabled={saving || orgs.length === 0} className="btn btn-primary disabled:opacity-50">
              {saving ? "Guardando..." : "Crear sucursal"}
            </button>
          </form>

          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Listado</h2>
            {loading ? (
              <p className="text-gray-400">Cargando...</p>
            ) : orgs.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No hay organizaciones. Corre <code className="text-xs">scripts/11_organizations.sql</code> en
                Neon si ya tenías bares, o crea la primera aquí.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {orgs.map((o) => (
                  <li key={o.id} className="py-3 flex justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{o.name}</p>
                      <p className="text-gray-400 text-xs">
                        {o.location_count ?? 0} sucursal(es) · {o.admin_count ?? 0} admin(s) ·{" "}
                        {o.status}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">#{o.id}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
