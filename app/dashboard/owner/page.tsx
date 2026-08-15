"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

interface Bar {
  id: number;
  name: string;
  address: string;
  active: boolean;
  totalTables: number;
  occupiedTables: number;
  adminCount: number;
  waiterCount: number;
  revenueToday: number;
  ordersToday: number;
  revenueMonth: number;
}

interface Totals {
  totalBars: number;
  activeBars: number;
  revenueToday: number;
  revenueMonth: number;
  ordersToday: number;
}

export default function OwnerPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const [bars, setBars] = useState<Bar[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "owner") router.push("/dashboard");
  }, [user, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/owner/stats");
      if (res.ok) {
        const data = await res.json();
        setBars(data.bars);
        setTotals(data.totals);
      } else {
        const d = await res.json();
        setError(d.error || "Error al cargar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleToggle = async (bar: Bar) => {
    setToggling(bar.id);
    setError(null);
    try {
      const res = await fetch("/api/owner/bars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bar.id, active: !bar.active }),
      });
      if (res.ok) {
        setBars(prev => prev.map(b => b.id === bar.id ? { ...b, active: !b.active } : b));
      } else {
        const d = await res.json();
        setError(d.error || "Error al actualizar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setToggling(null);
    }
  };

  if (user?.role !== "owner") {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-foreground">Redirigiendo...</div></div>;
  }

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-10">

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">Panel Superadmin</h1>
            <p className="text-gray-400 mt-1">Vista consolidada de todos tus bares</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Global stats */}
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
              <div className="card text-center">
                <p className="text-gray-400 text-xs mb-1">Bares totales</p>
                <p className="text-3xl font-bold text-primary">{totals.totalBars}</p>
              </div>
              <div className="card text-center">
                <p className="text-gray-400 text-xs mb-1">Bares activos</p>
                <p className="text-3xl font-bold text-green-400">{totals.activeBars}</p>
              </div>
              <div className="card text-center">
                <p className="text-gray-400 text-xs mb-1">Órdenes hoy</p>
                <p className="text-3xl font-bold text-secondary">{totals.ordersToday}</p>
              </div>
              <div className="card text-center col-span-2 md:col-span-1">
                <p className="text-gray-400 text-xs mb-1">Ingresos hoy</p>
                <p className="text-2xl font-bold text-green-400">{formatCOP(totals.revenueToday)}</p>
              </div>
              <div className="card text-center col-span-2 md:col-span-1">
                <p className="text-gray-400 text-xs mb-1">Ingresos este mes</p>
                <p className="text-2xl font-bold text-primary">{formatCOP(totals.revenueMonth)}</p>
              </div>
            </div>
          )}

          {/* Bars list */}
          <h2 className="text-xl font-semibold text-foreground mb-4">Bares</h2>

          {loading ? (
            <div className="text-gray-400">Cargando...</div>
          ) : bars.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400">No hay bares registrados.</p>
              <button onClick={() => router.push("/dashboard/bars")} className="btn-primary mt-4">
                Gestionar Bares
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {bars.map(bar => (
                <div
                  key={bar.id}
                  className={`card border-2 transition-all ${bar.active ? "border-border" : "border-red-500/40 opacity-60"}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground">{bar.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bar.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {bar.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{bar.address}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(bar)}
                      disabled={toggling === bar.id}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50 ${bar.active
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                          : "bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30"
                        }`}
                    >
                      {toggling === bar.id ? "..." : bar.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-background/50 rounded-lg p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Mesas</p>
                      <p className="font-bold text-foreground">
                        {bar.occupiedTables}<span className="text-gray-500 font-normal text-xs">/{bar.totalTables}</span>
                      </p>
                      <p className="text-gray-500 text-xs">ocupadas</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Equipo</p>
                      <p className="font-bold text-foreground">{bar.adminCount + bar.waiterCount}</p>
                      <p className="text-gray-500 text-xs">{bar.adminCount} admin · {bar.waiterCount} mes.</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Órdenes hoy</p>
                      <p className="font-bold text-secondary">{bar.ordersToday}</p>
                    </div>
                  </div>

                  {/* Revenue */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Ingresos hoy</p>
                      <p className="font-bold text-green-400 text-sm">{formatCOP(bar.revenueToday)}</p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Ingresos mes</p>
                      <p className="font-bold text-primary text-sm">{formatCOP(bar.revenueMonth)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-8 flex gap-3 flex-wrap">
            <button
              onClick={() => router.push("/dashboard/bars")}
              className="btn-primary"
            >
              + Gestionar Bares
            </button>
            <button
              onClick={() => router.push("/dashboard/users")}
              className="btn-secondary"
            >
              Gestionar Usuarios
            </button>
            <button
              onClick={fetchStats}
              className="px-4 py-2 text-sm bg-card border border-border text-gray-400 hover:text-foreground rounded-lg transition-smooth"
            >
              ↻ Actualizar
            </button>
          </div>

        </div>
      </div>
    </ProtectedLayout>
  );
}