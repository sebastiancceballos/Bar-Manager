"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DashboardStats {
  totalRevenue: number;
  ordersToday: number;
  tablesOccupied: number;
  totalTables: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === "waiter") {
      router.push("/dashboard/tables");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

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
  }, [user]);

  if (user?.role === "waiter") {
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
          <h1 className="text-4xl font-bold text-foreground mb-8">
            Panel de Administración
          </h1>

          {loading ? (
            <div className="text-gray-400">Cargando estadísticas...</div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card">
                  <p className="text-gray-400 text-sm mb-1">Ingresos Hoy</p>
                  <p className="text-3xl font-bold text-success">
                    ${Number(stats?.totalRevenue || 0).toFixed(2)}
                  </p>
                </div>
                <div className="card">
                  <p className="text-gray-400 text-sm mb-1">Órdenes Hoy</p>
                  <p className="text-3xl font-bold text-foreground">
                    {stats?.ordersToday || 0}
                  </p>
                </div>
                <div className="card">
                  <p className="text-gray-400 text-sm mb-1">Mesas Ocupadas</p>
                  <p className="text-3xl font-bold text-secondary">
                    {stats?.tablesOccupied || 0}
                  </p>
                </div>
                <div className="card">
                  <p className="text-gray-400 text-sm mb-1">Total Mesas</p>
                  <p className="text-3xl font-bold text-foreground">
                    {stats?.totalTables || 0}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                <Link
                  href="/dashboard/products"
                  className="card hover:border-primary transition-smooth cursor-pointer group"
                >
                  <h3 className="text-xl font-semibold text-foreground group-hover:text-primary mb-2">
                    Gestionar Productos
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Crea, edita y elimina productos del menú
                  </p>
                </Link>

                <Link
                  href="/dashboard/tables"
                  className="card hover:border-primary transition-smooth cursor-pointer group"
                >
                  <h3 className="text-xl font-semibold text-foreground group-hover:text-primary mb-2">
                    Gestionar Mesas
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Organiza el layout de mesas de tu bar
                  </p>
                </Link>

                <Link
                  href="/dashboard/reports"
                  className="card hover:border-primary transition-smooth cursor-pointer group"
                >
                  <h3 className="text-xl font-semibold text-foreground group-hover:text-primary mb-2">
                    Reportes
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Analiza ventas e ingresos por período
                  </p>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
