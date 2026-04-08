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
  created_at: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "waiter" as "admin" | "waiter",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only owner and admin can access this page
  const canAccess = user?.role === "owner" || user?.role === "admin";
  const canCreateAdmins = user?.role === "owner";

  useEffect(() => {
    if (user && !canAccess) {
      router.push("/dashboard/tables");
    }
  }, [user, canAccess, router]);

  // Fetch users
  useEffect(() => {
    if (!canAccess) return;

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

    fetchUsers();
  }, [canAccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear usuario");
      }

      setSuccess(`Usuario ${data.user.name} creado exitosamente`);
      setFormData({ name: "", email: "", password: "", role: "waiter" });
      setShowForm(false);

      // Refresh users list
      const usersResponse = await fetch("/api/users");
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Redirigiendo...</div>
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <Link href="/dashboard" className="text-primary hover:underline text-sm mb-2 inline-block">
                &larr; Volver al Dashboard
              </Link>
              <h1 className="text-4xl font-bold text-foreground">
                Gestión de Usuarios
              </h1>
              <p className="text-gray-400 mt-2">
                {canCreateAdmins 
                  ? "Como owner, puedes crear administradores"
                  : "Como admin, puedes crear meseros"}
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn btn-primary"
            >
              {showForm ? "Cancelar" : "Nuevo Usuario"}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded p-4 mb-6">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500 rounded p-4 mb-6">
              <p className="text-green-500">{success}</p>
            </div>
          )}

          {showForm && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold mb-4">Crear Nuevo Usuario</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
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
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "waiter" })}
                    className="input w-full"
                  >
                    {canCreateAdmins && <option value="admin">Administrador</option>}
                    <option value="waiter">Mesero</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary w-full"
                >
                  {submitting ? "Creando..." : "Crear Usuario"}
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400">Cargando usuarios...</div>
          ) : (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Usuarios del Sistema</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4">Nombre</th>
                      <th className="text-left py-3 px-4">Email</th>
                      <th className="text-left py-3 px-4">Rol</th>
                      <th className="text-left py-3 px-4">Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border/50">
                        <td className="py-3 px-4">{u.name}</td>
                        <td className="py-3 px-4 text-gray-400">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            u.role === "owner" 
                              ? "bg-purple-500/20 text-purple-400"
                              : u.role === "admin"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-green-500/20 text-green-400"
                          }`}>
                            {u.role === "owner" ? "Owner" : u.role === "admin" ? "Admin" : "Mesero"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400">
                          No hay usuarios registrados
                        </td>
                      </tr>
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
