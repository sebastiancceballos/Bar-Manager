"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { downloadInvoice } from "@/app/components/InvoicePDF";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

interface TodayTicket {
  id: number;
  table_number: string | null;
  ticket_number?: string | null;
  order_type?: string | null;
  client_name?: string | null;
  total_amount: number;
  subtotal_amount?: number | null;
  tax_amount?: number;
  tip_amount?: number;
  discount_amount?: number;
  payment_method?: string | null;
  status: string;
  created_at: string;
  closed_at?: string | null;
  location_name?: string | null;
  items: {
    id?: number;
    product_name: string;
    quantity: number;
    price: number;
    notes?: string | null;
  }[];
}

export default function HistorialPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<TodayTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (user.role !== "cashier") {
      router.replace("/dashboard/tables");
    }
  }, [user, isLoading, router]);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cashier/today-tickets");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los pedidos");
        setTickets([]);
        return;
      }
      setTickets(data.orders || []);
    } catch {
      setError("Error de conexión");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "cashier") fetchTickets();
  }, [user?.role]);

  const filtered = tickets.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const label = t.ticket_number
      ? String(t.ticket_number)
      : t.table_number
        ? `mesa ${t.table_number}`
        : `#${t.id}`;
    return (
      label.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      (t.payment_method || "").toLowerCase().includes(q)
    );
  });

  const handleReprint = (order: TodayTicket) => {
    downloadInvoice({
      id: order.id,
      table_number: order.table_number || undefined,
      ticket_number: order.ticket_number,
      order_type: order.order_type,
      client_name: order.client_name,
      total_amount: order.total_amount,
      subtotal_amount: order.subtotal_amount,
      tax_amount: order.tax_amount,
      tip_amount: order.tip_amount,
      discount_amount: order.discount_amount,
      payment_method: order.payment_method,
      status: order.status,
      created_at: order.created_at,
      location_name: order.location_name || undefined,
      items: order.items,
    });
  };

  if (!user || user.role !== "cashier") {
    return (
      <ProtectedLayout>
        <Navigation />
        <div className="p-8 text-gray-400">Cargando…</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-4xl font-bold text-foreground">Historial</h1>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={fetchTickets}
              disabled={loading}
            >
              {loading ? "…" : "Actualizar"}
            </button>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Pedidos de hoy</h2>
            <p className="text-sm text-gray-400">
              Cobros de hoy de tu local. Usa{" "}
              <strong className="text-foreground">Imprimir</strong> si falló la
              impresora o el cliente pide otra copia.
            </p>
            <input
              type="search"
              className="input w-full"
              placeholder="Buscar mesa, ficho o #pedido…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {error && (
              <div className="bg-error/10 border border-error text-error text-sm px-3 py-2 rounded">
                {error}
              </div>
            )}
            {loading && tickets.length === 0 ? (
              <p className="text-gray-400 text-sm">Cargando pedidos…</p>
            ) : filtered.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No hay cobros de hoy para mostrar.
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((t) => {
                  const title =
                    t.order_type === "self_service" || t.ticket_number
                      ? `Ficho ${t.ticket_number || "#" + t.id}`
                      : `Mesa ${t.table_number || "—"} · #${t.id}`;
                  const when = new Date(
                    t.closed_at || t.created_at
                  ).toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li
                      key={t.id}
                      className="card-sm flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{title}</p>
                        <p className="text-xs text-gray-400">
                          {when}
                          {t.payment_method
                            ? ` · ${
                                PAYMENT_LABELS[t.payment_method] ||
                                t.payment_method
                              }`
                            : ""}
                          {" · "}
                          {formatCOP(t.total_amount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm shrink-0"
                        onClick={() => handleReprint(t)}
                      >
                        Imprimir
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </ProtectedLayout>
  );
}
