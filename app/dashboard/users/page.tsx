"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  location_id: number | null;
  location_name: string | null;
  created_at: string;
}

interface Location {
  id: number;
  name: string;
  address: string;
}

type NewUserRole = "admin" | "waiter";

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin" as NewUserRole,
    location_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin";
  const canAccess = isOwner || isAdmin;

  useEffect(() => {
    if (user && !canAccess) {
      router.push("/dashboard/tables");
    }
  }, [user, canAccess, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchUsers();
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.locations || []))
      .catch(console.error);
  }, [canAccess]);

  // Owner creates admins; Admin creates waiters
  const roleOptions: { value: NewUserRole; label: string }[] = isOwner
    ? [{ value: "admin", label: "Administrador" }]
    : [{ value: "waiter", label: "Mesero" }];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...formData };
      if (formData.location_id) payload.location_id = parseInt(formData.location_id);
      else delete payload.location_id;

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Error al crear usuario");

      setSuccess(`Usuario ${data.user.name} creado exitosamente`);
      setFormData({ name: "", email: "", password: "", role: isOwner ? "admin" : "waiter", location_id: "" });
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (targetId: number) => {
    setDeletingId(targetId);
    setError(null);
    try {
      const response = await fetch(`/api/users/${targetId}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Error al eliminar usuario");

      setSuccess(data.message);
      setUsers((prev) => prev.filter((u) => u.id !== targetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const canDeleteUser = (target: User) => {
    if (target.id === user?.id) return false;
    if (isOwner && (target.role === "admin" || target.role === "waiter")) return true;
    if (isAdmin && target.role === "waiter") return true;
    return false;
  };

  // Group users by location for owner view
  const groupedByLocation = isOwner
    ? users.reduce<Record<string, User[]>>((acc, u) => {
        const key = u.location_name || "Sin bar asignado";
        if (!acc[key]) acc[key] = [];
        acc[key].push(u);
        return acc;
      }, {})
    : null;

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Redirigiendo...</div>
      </div>
    );
  }

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      owner: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
      admin: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
      waiter: "bg-green-500/20 text-green-400 border border-green-500/30",
    };
    const labels: Record<string, string> = { owner: "Owner", admin: "Admin", waiter: "Mesero" };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[role] || ""}`}>
        {labels[role] || role}
      </span>
    );
  };

  const UserRow = ({ u }: { u: User }) => (
    <tr key={u.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
      <td className="py-3 px-4 font-medium">{u.name}</td>
      <td className="py-3 px-4 text-gray-400 text-sm">{u.email}</td>
      <td className="py-3 px-4">{roleBadge(u.role)}</td>
      <td className="py-3 px-4 text-gray-400 text-sm">
        {new Date(u.created_at).toLocaleDateString("es-ES")}
      </td>
      <td className="py-3 px-4">
        {canDeleteUser(u) && (
          <>
            {confirmDeleteId === u.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Confirmar?</span>
                <button
                  onClick={() => handleDelete(u.id)}
                  disabled={deletingId === u.id}
                  className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/40 transition-colors"
                >
                  {deletingId === u.id ? "Eliminando..." : "Si, eliminar"}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1 rounded text-xs bg-card text-gray-400 border border-border hover:bg-border transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(u.id)}
                className="px-3 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/30 transition-colors"
              >
                Eliminar
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-12">

          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <Link href="/dashboard" className="text-primary hover:underline text-sm mb-2 inline-block">
                &larr; Volver al Dashboard
              </Link>
              <h1 className="text-4xl font-bold text-foreground">Gestionar Usuarios</h1>
              <p className="text-gray-400 mt-2">
                {isOwner
                  ? "Como owner puedes crear y eliminar administradores de cada bar"
                  : "Como admin puedes crear y eliminar meseros de tu bar"}
              </p>
            </div>
            <button
              onClick={() => { setShowForm(!showForm); setError(null); setSuccess(null); }}
              className="btn btn-primary"
            >
              {showForm ? "Cancelar" : isOwner ? "Nuevo Administrador" : "Nuevo Mesero"}
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Create Form */}
          {showForm && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold mb-6">
                {isOwner ? "Crear Nuevo Administrador" : "Crear Nuevo Mesero"}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre completo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input w-full"
                    placeholder="juan@ejemplo.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Contraseña</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input w-full"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bar asignado</label>
                  <select
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Sin asignar</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                {roleOptions.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Rol</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as NewUserRole })}
                      className="input w-full"
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-2">
                  <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                    {submitting ? "Creando..." : `Crear ${isOwner ? "Administrador" : "Mesero"}`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List */}
          {loading ? (
            <div className="text-gray-400 py-12 text-center">Cargando usuarios...</div>
          ) : isOwner && groupedByLocation ? (
            // Owner view: grouped by bar
            Object.keys(groupedByLocation).length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-400">No hay usuarios registrados aun</p>
              </div>
            ) : (
              Object.entries(groupedByLocation).map(([locationName, locationUsers]) => (
                <div key={locationName} className="card mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-6 bg-primary rounded-full" />
                    <h2 className="text-xl font-semibold">{locationName}</h2>
                    <span className="text-sm text-gray-400">({locationUsers.length} usuario{locationUsers.length !== 1 ? "s" : ""})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-sm text-gray-400">
                          <th className="text-left py-2 px-4 font-medium">Nombre</th>
                          <th className="text-left py-2 px-4 font-medium">Email</th>
                          <th className="text-left py-2 px-4 font-medium">Rol</th>
                          <th className="text-left py-2 px-4 font-medium">Creado</th>
                          <th className="text-left py-2 px-4 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locationUsers.map((u) => <UserRow key={u.id} u={u} />)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )
          ) : (
            // Admin view: flat list of their waiters
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Meseros de tu bar</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-sm text-gray-400">
                      <th className="text-left py-2 px-4 font-medium">Nombre</th>
                      <th className="text-left py-2 px-4 font-medium">Email</th>
                      <th className="text-left py-2 px-4 font-medium">Rol</th>
                      <th className="text-left py-2 px-4 font-medium">Creado</th>
                      <th className="text-left py-2 px-4 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400">
                          No hay meseros en tu bar. Crea uno con el boton de arriba.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => <UserRow key={u.id} u={u} />)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedLayout>
  );
}
