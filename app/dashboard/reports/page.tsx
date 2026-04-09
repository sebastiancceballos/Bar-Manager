"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { DailyOrdersModal } from "@/app/components/DailyOrdersModal";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);


interface DailyReport {
  date: string;
  total: number;
  orderCount: number;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("week");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "owner") {
      router.push("/dashboard/tables");
    }
  }, [user, router]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch(`/api/reports?range=${dateRange}`);
        if (response.ok) {
          const data = await response.json();
          setReports(data.reports);
        }
      } catch (error) {
        console.error("Failed to fetch reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [dateRange]);

  const totalRevenue = reports.reduce((sum, r) => sum + r.total, 0);
  const totalOrders = reports.reduce((sum, r) => sum + r.orderCount, 0);
  const averagePerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const handleViewMore = (date: string) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold text-foreground">Reportes</h1>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="select"
            >
              <option value="week">Última Semana</option>
              <option value="month">Último Mes</option>
              <option value="year">Último Año</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <h3 className="text-gray-400 text-sm font-medium mb-2">
                Ingresos Totales
              </h3>
              <p className="text-3xl font-bold text-success">
                {formatCOP(totalRevenue)}
              </p>
            </div>

            <div className="card">
              <h3 className="text-gray-400 text-sm font-medium mb-2">
                Total de Órdenes
              </h3>
              <p className="text-3xl font-bold text-primary">
                {totalOrders}
              </p>
            </div>

            <div className="card">
              <h3 className="text-gray-400 text-sm font-medium mb-2">
                Promedio por Orden
              </h3>
              <p className="text-3xl font-bold text-secondary">
                {formatCOP(averagePerOrder)}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-400">Cargando reportes...</div>
          ) : (
            <div className="card">
              <h3 className="text-xl font-semibold mb-6">
                Ingresos por Día
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 px-4 font-semibold">Fecha</th>
                      <th className="pb-3 px-4 font-semibold">Órdenes</th>
                      <th className="pb-3 px-4 font-semibold">Ingresos</th>
                      <th className="pb-3 px-4 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr
                        key={report.date}
                        className="border-b border-border/50 hover:bg-card/50 transition-smooth"
                      >
                        <td className="py-3 px-4">
                          {new Date(report.date).toLocaleDateString("es-MX")}
                        </td>
                        <td className="py-3 px-4">{report.orderCount}</td>
                        <td className="py-3 px-4 text-success font-semibold">
                          {formatCOP(report.total)}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleViewMore(report.date)}
                            className="bg-primary text-white px-4 py-1 rounded text-sm hover:bg-primary/90 transition-colors"
                          >
                            Ver más
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {reports.length === 0 && (
                  <div className="py-8 text-center text-gray-400">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedDate && (
        <DailyOrdersModal
          date={selectedDate}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedDate(null);
          }}
        />
      )}
    </ProtectedLayout>
  );
}