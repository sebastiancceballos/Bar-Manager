"use client";

import { useI18n } from "@/app/i18n-provider";

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
  const { t } = useI18n();

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
        setError(data.error || t("errorSaving"));
        return;
      }

      setShowForm(false);
      setEditingLocation(null);
      setFormData({ name: "", address: "" });
      fetchLocations();
    } catch (err) {
      setError(t("connectionError"));
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({ name: location.name, address: location.address });
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("confirmDeleteBar"))) return;

    setDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errorDeleting"));
        return;
      }

      fetchLocations();
    } catch (err) {
      setError(t("connectionError"));
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
        <div className="text-foreground">{t("redirecting")}</div>
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{t("manageBars")}</h1>
            <button onClick={openNewForm} className="btn-primary">
              {t("newBarButton")}
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
                {editingLocation ? t("editBar") : t("createNewBar")}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t("barNameLabel")}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    placeholder={t("barNamePlaceholder")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t("addressLabel")}</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input w-full"
                    placeholder={t("addressExamplePlaceholder")}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">
                    {editingLocation ? t("saveChanges") : t("createBar")}
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
                    {t("cancel")}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400">{t("loadingBars")}</div>
          ) : locations.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 mb-4">{t("noData")}</p>
              <button onClick={openNewForm} className="btn-primary">
                {t("createFirstBar")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-foreground break-words">
                      {location.name}
                    </h3>
                    <p className="text-sm text-gray-400 break-words">{location.address}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(location)}
                      className="min-h-[44px] px-3 py-2 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-smooth"
                    >
                      {t("edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
                      disabled={deleting === location.id}
                      className="min-h-[44px] px-3 py-2 text-sm bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-smooth disabled:opacity-50"
                    >
                      {deleting === location.id ? t("deleting") : t("delete")}
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
