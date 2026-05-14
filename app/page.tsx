"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/app/components/Skeleton";
import { useCallback } from "react";
import { 
  Package, 
  TableProperties, 
  BarChart3, 
  Users, 
  Beer,
  DollarSign,
  ClipboardList,
  Users2
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  stock: number;
  category: string;
}

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);


interface DashboardStats {
  totalRevenue: number;
  ordersToday: number;
  tablesOccupied: number;
  totalTables: number;
}

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

  // Check if user is admin or owner (both can view dashboard)
  const isAdminOrOwner = user?.role === "admin" || user?.role === "owner";

  const fetchStats = useCallback(async () => {
    if (!user || !isAdminOrOwner) return;
    try {
      // Fetch general stats
      const statsRes = await fetch("/api/dashboard/stats");
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      // Fetch low stock products
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
    const interval = setInterval(fetchStats, 10000); // Poll every 10 seconds
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
          <h1 className="text-4xl font-bold text-foreground mb-8">
            Panel de Administración
          </h1>

          {loading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="card flex flex-col gap-2">
                    <Skeleton className="w-24 h-4 opacity-50" />
                    <Skeleton className="w-32 h-8" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="card flex flex-col gap-4">
                    <Skeleton className="w-48 h-6" />
                    <Skeleton className="w-full h-12 opacity-30" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Lado Izquierdo: Novedades / Alertas */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="card border-primary/30 bg-primary/5">
                    <div className="flex items-center gap-2 mb-4 text-primary">
                      <Package size={20} />
                      <h2 className="text-sm font-bold uppercase tracking-wider">
                        PROXIMOS PRODUCTOS A ESTAR AGOTADOS:
                      </h2>
                    </div>
                    
                    <div className="space-y-3">
                      {lowStockProducts.length === 0 ? (
                        <p className="text-gray-400 text-sm italic">
                          Todo al día. No hay productos por agotarse.
                        </p>
                      ) : (
                        lowStockProducts.map(p => (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50 group hover:border-primary/50 transition-colors">
                            <div>
                              <p className="font-semibold text-sm">{p.name}</p>
                              <p className="text-[10px] text-gray-500 uppercase">{p.category}</p>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                              p.stock <= 0 ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                            }`}>
                              {p.stock <= 0 ? "AGOTADO" : `${p.stock} unid.`}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <Link 
                      href="/dashboard/products" 
                      className="mt-6 block text-center text-xs text-primary hover:underline font-medium"
                    >
                      Ver todo el inventario →
                    </Link>
                  </div>

                  {/* Acceso Rápido a Usuarios (Pequeño) */}
                  <div className="card bg-card/50">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-widest">Atajos de Equipo</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/dashboard/users" className="p-2 rounded bg-background border border-border hover:border-primary text-center text-xs transition-colors">
                        Meseros
                      </Link>
                      <Link href="/dashboard/reports" className="p-2 rounded bg-background border border-border hover:border-primary text-center text-xs transition-colors">
                        Ventas
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Lado Derecho: Estadísticas Principales */}
                <div className="lg:col-span-8 space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link
                      href="/dashboard/products"
                      className="card hover:border-primary transition-smooth cursor-pointer group flex flex-col gap-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-smooth">
                        <Package size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">
                          Gestionar Productos
                        </h3>
                        <p className="text-gray-400 text-xs">
                          Crea, edita y elimina productos del menú
                        </p>
                      </div>
                    </Link>

                    <Link
                      href="/dashboard/tables"
                      className="card hover:border-primary transition-smooth cursor-pointer group flex flex-col gap-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-smooth">
                        <TableProperties size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">
                          Gestionar Mesas
                        </h3>
                        <p className="text-gray-400 text-xs">
                          Organiza el layout de mesas de tu bar
                        </p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}