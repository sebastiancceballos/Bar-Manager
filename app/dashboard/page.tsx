"use client";

import { ProtectedLayout, AdminOnly } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";

interface DashboardStats {
  totalRevenue: number;
  ordersToday: number;
  tablesOccupied: number;
  totalTables: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <ProtectedLayout>
      <AdminOnly>
        <Navigation />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <h1 className="text-4xl font-bold text-foreground mb-8">
              Dashboard
            </h1>

            {loading ? (
              <div className="text-gray-400">Cargando estadísticas...</div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">
                    Ingresos Hoy
                  </h3>
                  <p className="text-3xl font-bold text-success">
                    ${stats.totalRevenue.toFixed(2)}
                  </p>
                </div>

                <div className="card">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">
                    Órdenes Hoy
                  </h3>
                  <p className="text-3xl font-bold text-primary">
                    {stats.ordersToday}
                  </p>
                </div>

                <div className="card">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">
                    Mesas Ocupadas
                  </h3>
                  <p className="text-3xl font-bold text-secondary">
                    {stats.tablesOccupied}/{stats.totalTables}
                  </p>
                </div>

                <div className="card">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">
                    Utilización
                  </h3>
                  <p className="text-3xl font-bold text-warning">
                    {stats.totalTables > 0
                      ? Math.round(
                          (stats.tablesOccupied / stats.totalTables) * 100
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-error">
                Error cargando estadísticas
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
              <a
                href="/dashboard/products"
                className="card hover:border-primary transition-smooth cursor-pointer group"
              >
                <h3 className="text-xl font-semibold text-foreground group-hover:text-primary mb-2">
                  Gestionar Productos
                </h3>
                <p className="text-gray-400 text-sm">
                  Crea, edita y elimina productos del menú
                </p>
              </a>

              <a
                href="/dashboard/tables"
                className="card hover:border-primary transition-smooth cursor-pointer group"
              >
                <h3 className="text-xl font-semibold text-foreground group-hover:text-primary mb-2">
                  Gestionar Mesas
                </h3>
                <p className="text-gray-400 text-sm">
                  Organiza el layout de mesas de tu bar
                </p>
              </a>

              <a
                href="/dashboard/reports"
                className="card hover:border-primary transition-smooth cursor-pointer group"
              >
                <h3 className="text-xl font-semibold text-foreground group-hover:text-primary mb-2">
                  Reportes
                </h3>
                <p className="text-gray-400 text-sm">
                  Analiza ventas e ingresos por período
                </p>
              </a>
            </div>
          </div>
        </div>
      </AdminOnly>
    </ProtectedLayout>
  );
}
