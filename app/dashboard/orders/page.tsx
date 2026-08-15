"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { Search, CreditCard, CheckCircle2, Printer, Loader2, Ban } from "lucide-react";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
  price: number;
}

interface SelfServiceOrder {
  id: number;
  ticket_number: string;
  status: string;
  total_amount: number;
  client_name?: string;
  created_at: string;
  items: OrderItem[];
}

const ALLOWED_ROLES = ["owner", "admin", "cashier"];

const TABS: { key: string; label: string }[] = [
  { key: "", label: "Todos (activos)" },
  { key: "PENDING_PAYMENT", label: "Por cobrar" },
  { key: "PREPARING", label: "En preparación" },
  { key: "READY", label: "Listos" },
];

function OrdersDashboardContent() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SelfServiceOrder[]>([]);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SelfServiceOrder | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = search ? `?ticket=${encodeURIComponent(search)}` : tab ? `?status=${tab}` : "";
      const res = await fetch(`/api/self-service/orders${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando pedidos");
    } finally {
      setIsLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function changeStatus(id: number, status: string, paymentMethod?: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/self-service/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "PAID" ? { paymentMethod: paymentMethod || "efectivo" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el pedido");
    } finally {
      setBusyId(null);
    }
  }

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-error">
        No tienes permiso para acceder aquí
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-8">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Caja · Pedidos de autoservicio</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número de ficho (ej. 0042)"
              className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-3 text-base"
            />
          </div>
        </div>

        {!search && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-[44px] px-4 rounded-full text-sm whitespace-nowrap ${
                  tab === t.key ? "bg-primary text-white" : "bg-card border border-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-error text-sm mb-3">{error}</p>}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-foreground/60 text-center py-10">No hay pedidos en esta vista.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xl font-black">{order.ticket_number}</span>
                    {order.client_name && (
                      <span className="ml-2 text-sm text-foreground/60">{order.client_name}</span>
                    )}
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <ul className="text-sm text-foreground/70 mt-2">
                  {order.items.map((item, i) => (
                    <li key={i}>
                      {item.quantity}× {item.name}
                      {item.notes && <span className="opacity-60"> ({item.notes})</span>}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between mt-3">
                  <span className="font-bold">{formatCOP(Number(order.total_amount))}</span>
                  <div className="flex gap-2">
                    <a
                      href={`/print-ticket/${order.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-background border border-border rounded-lg"
                      title="Imprimir ticket"
                    >
                      <Printer className="w-4 h-4" />
                    </a>
                    {order.status === "PENDING_PAYMENT" && (
                      <>
                        <button
                          disabled={busyId === order.id}
                          onClick={() => changeStatus(order.id, "PAID")}
                          className="min-h-[44px] px-4 bg-success text-white rounded-lg flex items-center gap-2 font-semibold disabled:opacity-50"
                        >
                          <CreditCard className="w-4 h-4" /> Confirmar pago
                        </button>
                        <button
                          disabled={busyId === order.id}
                          onClick={() => setCancelTarget(order)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-background border border-border text-error rounded-lg disabled:opacity-50"
                          title="Cancelar pedido"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {order.status === "READY" && (
                      <button
                        disabled={busyId === order.id}
                        onClick={() => changeStatus(order.id, "COMPLETED")}
                        className="min-h-[44px] px-4 bg-primary text-white rounded-lg flex items-center gap-2 font-semibold disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Entregado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirmación al cancelar */}
        {cancelTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h2 className="text-lg font-bold text-foreground mb-2">
                ¿Cancelar este pedido?
              </h2>
              <p className="text-sm text-foreground/70 mb-1">
                Ficho{" "}
                <span className="font-black text-foreground">
                  {cancelTarget.ticket_number}
                </span>
                {cancelTarget.client_name
                  ? ` · ${cancelTarget.client_name}`
                  : ""}
              </p>
              <p className="text-sm text-foreground/60 mb-6">
                Esta acción no se puede deshacer.
                {cancelTarget.status !== "PENDING_PAYMENT"
                  ? " El stock de los productos se devolverá al inventario."
                  : ""}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="flex-1 min-h-[44px] rounded-lg border border-border bg-background font-semibold"
                >
                  No
                </button>
                <button
                  type="button"
                  disabled={busyId === cancelTarget.id}
                  onClick={async () => {
                    const id = cancelTarget.id;
                    setCancelTarget(null);
                    await changeStatus(id, "CANCELLED");
                  }}
                  className="flex-1 min-h-[44px] rounded-lg bg-error text-white font-semibold disabled:opacity-50"
                >
                  Sí, cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING_PAYMENT: { label: "Por cobrar", className: "bg-warning/20 text-warning" },
    PAID: { label: "Pagado", className: "bg-primary/20 text-primary" },
    PREPARING: { label: "En preparación", className: "bg-secondary/20 text-secondary" },
    READY: { label: "Listo", className: "bg-success/20 text-success" },
    COMPLETED: { label: "Entregado", className: "bg-foreground/10 text-foreground/60" },
    CANCELLED: { label: "Cancelado", className: "bg-error/20 text-error" },
  };
  const info = map[status] || { label: status, className: "bg-foreground/10" };
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${info.className}`}>{info.label}</span>;
}

export default function OrdersDashboardPage() {
  return (
    <ProtectedLayout>
      <OrdersDashboardContent />
    </ProtectedLayout>
  );
}
