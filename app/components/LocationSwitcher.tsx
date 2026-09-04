"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";

type Loc = { id: number; name: string };

/**
 * Selector de sucursal activa (fase C).
 * Visible si el usuario tiene más de un local accesible (admin multi-sucursal o superadmin).
 */
export function LocationSwitcher() {
  const { user, refreshUser } = useAuth();
  const [locations, setLocations] = useState<Loc[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role === "owner") {
      // Superadmin puede usar el panel de bares; switcher opcional
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/locations");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setLocations(data.locations || []);
        setActiveId(data.activeLocationId ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || locations.length <= 1) return null;
  // Mesero/cajero normalmente 1 local; admin multi-bar sí
  if (user.role === "waiter" || user.role === "kitchen") return null;

  const onChange = async (value: string) => {
    const id = parseInt(value, 10);
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/me/active-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: id }),
      });
      if (res.ok) {
        setActiveId(id);
        await refreshUser?.();
        // Recargar datos de la sucursal activa
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] uppercase tracking-wide text-gray-500 hidden sm:inline">
        Sucursal
      </label>
      <select
        className="input py-1 px-2 text-sm max-w-[160px] md:max-w-[200px]"
        value={activeId ?? ""}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        title="Cambiar sucursal activa"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}
