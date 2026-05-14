"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/app/components/Skeleton";
import { 
  Package, 
  TableProperties, 
  BarChart3, 
  Users, 
  Beer,
  DollarSign,
  ClipboardList,
  Users2,
  AlertTriangle
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  stock: number;
  category: string;
}

interface DashboardStats {
  totalRevenue: number;
  ordersToday: number;
  tablesOccupied: number;
  totalTables: number;
}

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === "waiter") {
      router.push("/dashboard/tables");
    }
    if (user && user.role === "owner") {
      router.push("/dashboard/owner");
    }
  }, [user, router]);

  const isAdminOrOwner = user?.role === "admin" || user?.role === "owner";

  const fetchStats = useCallback(async () => {
    if (!user || !isAdminOrOwner) return;
    try {
      const statsRes = await fetch("/api/dashboard/stats");
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      const productsRes = await fetch("/api/products");
      if (productsRes.ok) {
        const data = await productsRes.json();
        const lowStock = (data.products as Product[]).filter(p => (p.stock || 0) <= 3);
        setLowStockProducts(lowStock);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdminOrOwner]);

  useEffect(() => {
    if (!user || !isAdminOrOwner) return;
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [user, isAdminOrOwner, fetchStats]);

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
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <h1 className="text-4xl font-bold text-foreground">
              Panel de Administración
            </h1>
            {lowStockProducts.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full animate-pulse">
                <AlertTriangle size={18} className="text-amber-500" />
                <span className="text-sm font-medium text-amber-500">
                  {lowStockProducts.length} productos por agotarse
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              
              {/* ALERTS SECTION (NOVEDADES) */}
              {lowStockProducts.length > 0 && (
                <div className="card border-primary/20 bg-primary/5 p-0 overflow-hidden">
                  <div className="bg-primary/10 px-6 py-3 border-b border-primary/20 flex items-center gap-2">
                    <Package size={18} className="text-primary" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-primary">
                      PROXIMOS PRODUCTOS A ESTAR AGOTADOS:
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {lowStockProducts.map(p => (
                        <div key={p.id} className="min-w-[200px] bg-background border border-border p-4 rounded-xl flex flex-col justify-between">
                          <div>
                            <p className="font-bold text-foreground leading-tight">{p.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase mt-1">{p.category}</p>
                          </div>
                          <div className={`mt-4 inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold w-fit ${
                            p.stock <= 0 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${p.stock <= 0 ? "bg-red-500" : "bg-amber-500"}`} />
                            {p.stock <= 0 ? "AGOTADO" : `${p.stock} UNIDADES`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MAIN STATS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 text-success/10 group-hover:text-success/20 transition-smooth">
                    <DollarSign size={80} />
                  </div>
                  <p className="text-gray-400 text-sm mb-1">Ingresos Hoy</p>
                  <p className="text-3xl font-bold text-success relative z-10">
                    {formatCOP(Number(stats?.totalRevenue || 0))}
                  </p>
                </div>
                <div className="card relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 text-primary/10 group-hover:text-primary/20 transition-smooth">
                    <ClipboardList size={80} />
                  </div>
                  <p className="text-gray-400 text-sm mb-1">Órdenes Hoy</p>
                  <p className="text-3xl font-bold text-foreground relative z-10">
                    {stats?.ordersToday || 0}
                  </p>
                </div>
                <div className="card relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 text-secondary/10 group-hover:text-secondary/20 transition-smooth">
                    <TableProperties size={80} />
                  </div>
                  <p className="text-gray-400 text-sm mb-1">Mesas Ocupadas</p>
                  <p className="text-3xl font-bold text-secondary relative z-10">
                    {stats?.tablesOccupied || 0}
                  </p>
                </div>
                <div className="card relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 text-foreground/5 group-hover:text-foreground/10 transition-smooth">
                    <Users2 size={80} />
                  </div>
                  <p className="text-gray-400 text-sm mb-1">Total Mesas</p>
                  <p className="text-3xl font-bold text-foreground relative z-10">
                    {stats?.totalTables || 0}
                  </p>
                </div>
              </div>

              {/* NAVIGATION GRID (BIG BUTTONS RESTORED) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                  href="/dashboard/products"
                  className="card hover:border-primary transition-all hover:-translate-y-1 cursor-pointer group flex flex-col gap-6 p-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-lg shadow-primary/5">
                    <Package size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      Productos
                    </h3>
                    <p className="text-gray-400">
                      Gestiona tu inventario, precios y categorías del menú
                    </p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/tables"
                  className="card hover:border-secondary transition-all hover:-translate-y-1 cursor-pointer group flex flex-col gap-6 p-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition-all shadow-lg shadow-secondary/5">
                    <TableProperties size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      Mesas
                    </h3>
                    <p className="text-gray-400">
                      Administra la distribución de mesas y ocupación
                    </p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/reports"
                  className="card hover:border-success transition-all hover:-translate-y-1 cursor-pointer group flex flex-col gap-6 p-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center text-success group-hover:bg-success group-hover:text-white transition-all shadow-lg shadow-success/5">
                    <BarChart3 size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      Reportes
                    </h3>
                    <p className="text-gray-400">
                      Ventas detalladas, movimientos de stock y cierres
                    </p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/users"
                  className="card hover:border-blue-500 transition-all hover:-translate-y-1 cursor-pointer group flex flex-col gap-6 p-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg shadow-blue-500/5">
                    <Users size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      Usuarios
                    </h3>
                    <p className="text-gray-400">
                      {user?.role === "owner" ? "Crea administradores" : "Crea y gestiona tus meseros"}
                    </p>
                  </div>
                </Link>

                {user?.role === "owner" && (
                  <Link
                    href="/dashboard/bars"
                    className="card hover:border-amber-500 transition-all hover:-translate-y-1 cursor-pointer group flex flex-col gap-6 p-8"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-lg shadow-amber-500/5">
                      <Beer size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">
                        Bares
                      </h3>
                      <p className="text-gray-400">
                        Administración global de locales del proyecto
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}