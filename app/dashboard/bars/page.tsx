"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";

interface Location {
  id: number;
  name: string;
  address: string;
}

export default function BarsManagementPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "owner") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations);
      }
    } catch (err) {
      console.error("Error fetching locations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const url = editingLocation
        ? `/api/locations/${editingLocation.id}`
        : "/api/locations";
      const method = editingLocation ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar");
        return;
      }

      setShowForm(false);
      setEditingLocation(null);
      setFormData({ name: "", address: "" });
      fetchLocations();
    } catch (err) {
      setError("Error de conexion");
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({ name: location.name, address: location.address });
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Estas seguro de eliminar este bar?")) return;

    setDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al eliminar");
        return;
      }

      fetchLocations();
    } catch (err) {
      setError("Error de conexion");
    } finally {
      setDeleting(null);
    }
  };

  const openNewForm = () => {
    setEditingLocation(null);
    setFormData({ name: "", address: "" });
    setShowForm(true);
    setError(null);
  };

  if (user?.role !== "owner") {
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
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-foreground">Gestionar Bares</h1>
            <button onClick={openNewForm} className="btn-primary">
              + Nuevo Bar
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded mb-6">
              {error}
            </div>
          )}

          {showForm && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold mb-4">
                {editingLocation ? "Editar Bar" : "Crear Nuevo Bar"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre del Bar</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    placeholder="Ej: Bar Principal"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Direccion</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input w-full"
                    placeholder="Ej: Calle Principal 123, Madrid"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">
                    {editingLocation ? "Guardar Cambios" : "Crear Bar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingLocation(null);
                      setError(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400">Cargando bares...</div>
          ) : locations.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 mb-4">No hay bares registrados</p>
              <button onClick={openNewForm} className="btn-primary">
                Crear tu primer bar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="card flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {location.name}
                    </h3>
                    <p className="text-sm text-gray-400">{location.address}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(location)}
                      className="px-3 py-2 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-smooth"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
                      disabled={deleting === location.id}
                      className="px-3 py-2 text-sm bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-smooth disabled:opacity-50"
                    >
                      {deleting === location.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
