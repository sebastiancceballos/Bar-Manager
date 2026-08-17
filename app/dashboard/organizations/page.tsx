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
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orgName, setOrgName] = useState("");
  const [createdOrgId, setCreatedOrgId] = useState<number | null>(null);
  const [barForm, setBarForm] = useState({ name: "", address: "" });
  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    locationId: "",
  });
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

  const loadLocations = async () => {
    const res = await fetch("/api/locations");
    if (res.ok) {
      const data = await res.json();
      setLocations(data.locations || []);
    }
  };

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear");
      setCreatedOrgId(data.organization.id);
      setMsg(`Organización "${data.organization.name}" creada`);
      setStep(2);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const createBar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdOrgId) {
      setError("Crea primero la organización (paso 1)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: barForm.name,
          address: barForm.address,
          organizationId: createdOrgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear sucursal");
      setMsg(`Sucursal "${data.location.name}" creada`);
      setBarForm({ name: "", address: "" });
      await loadLocations();
      await load();
      setStep(3);
      setAdminForm((f) => ({ ...f, locationId: String(data.location.id) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adminForm.name,
          email: adminForm.email,
          password: adminForm.password,
          role: "admin",
          location_id: adminForm.locationId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear admin");
      setMsg(`Administrador ${data.user?.email || adminForm.email} creado`);
      setAdminForm({ name: "", email: "", password: "", locationId: "" });
      setStep(1);
      setOrgName("");
      setCreatedOrgId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const patchOrg = async (id: number, body: { name?: string; status?: string }) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const deleteOrg = async (id: number) => {
    if (!confirm("¿Eliminar organización vacía?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
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
              Alta de cliente: organización → sucursales → administrador del negocio. CRUD:
              renombrar, suspender, eliminar (si no tiene sucursales).
            </p>
          </div>

          {error && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {msg && (
            <div className="bg-success/10 border border-success/40 text-success px-4 py-3 rounded-lg text-sm">
              {msg}
            </div>
          )}

          <div className="card space-y-4">
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
              <span className={step === 1 ? "text-primary" : "text-gray-500"}>1. Organización</span>
              <span className="text-gray-600">→</span>
              <span className={step === 2 ? "text-primary" : "text-gray-500"}>2. Sucursal</span>
              <span className="text-gray-600">→</span>
              <span className={step === 3 ? "text-primary" : "text-gray-500"}>3. Admin</span>
            </div>

            {step === 1 && (
              <form onSubmit={createOrg} className="space-y-3">
                <input
                  className="input w-full"
                  placeholder="Nombre del cliente / negocio"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
                <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
                  Crear y continuar
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={createBar} className="space-y-3">
                <p className="text-sm text-gray-400">Organización #{createdOrgId}</p>
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
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                    Atrás
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
                    Crear sucursal y continuar
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={createAdmin} className="space-y-3">
                <input
                  className="input w-full"
                  placeholder="Nombre del administrador"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  required
                />
                <input
                  className="input w-full"
                  type="email"
                  placeholder="Email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                />
                <input
                  className="input w-full"
                  type="password"
                  placeholder="Contraseña (mín. 6)"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  required
                  minLength={6}
                />
                <select
                  className="input w-full"
                  value={adminForm.locationId}
                  onChange={(e) => setAdminForm({ ...adminForm, locationId: e.target.value })}
                  required
                >
                  <option value="">Sucursal</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>
                    Atrás
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
                    Crear administrador
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Listado y gestión</h2>
            {loading ? (
              <p className="text-gray-400">Cargando...</p>
            ) : orgs.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No hay organizaciones. Usa el asistente o el SQL de migración en Neon.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {orgs.map((o) => (
                  <li
                    key={o.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {o.name}{" "}
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            o.status === "active"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning"
                          }`}
                        >
                          {o.status}
                        </span>
                      </p>
                      <p className="text-gray-400 text-xs">
                        #{o.id} · {o.location_count ?? 0} sucursal(es) · {o.admin_count ?? 0} admin(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={saving}
                        onClick={() => {
                          const n = prompt("Nuevo nombre", o.name);
                          if (n && n.trim()) patchOrg(o.id, { name: n.trim() });
                        }}
                      >
                        Renombrar
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={saving}
                        onClick={() =>
                          patchOrg(o.id, {
                            status: o.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {o.status === "active" ? "Suspender" : "Activar"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm text-error"
                        disabled={saving}
                        onClick={() => deleteOrg(o.id)}
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setCreatedOrgId(o.id);
                          setStep(2);
                          setMsg(`Añadir sucursal a "${o.name}"`);
                          loadLocations();
                        }}
                      >
                        + Sucursal
                      </button>
                    </div>
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
