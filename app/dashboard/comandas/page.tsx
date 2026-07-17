"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Skeleton } from "@/app/components/Skeleton";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

type ItemStatus = "pendiente" | "preparando" | "listo" | "entregado";

interface ComandaItem {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  status: ItemStatus;
  product: {
    name: string;
    price: number;
    category: string;
  };
}

interface ComandaOrder {
  id: number;
  table_id: number;
  table_number: string;
  waiter_name: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items: ComandaItem[];
}

const STATUS_FLOW: Record<ItemStatus, { next: ItemStatus | null; label: string; actionLabel: string }> = {
  pendiente: { next: "preparando", label: "Pendiente", actionLabel: "Empezar" },
  preparando: { next: "listo", label: "Preparando", actionLabel: "Marcar listo" },
  listo: { next: "entregado", label: "Listo", actionLabel: "Entregar" },
  entregado: { next: null, label: "Entregado", actionLabel: "" },
};

const STATUS_STYLES: Record<ItemStatus, string> = {
  pendiente: "bg-warning/10 text-warning border-warning/30",
  preparando: "bg-secondary/10 text-secondary border-secondary/30",
  listo: "bg-success/10 text-success border-success/30",
  entregado: "bg-gray-700/30 text-gray-500 border-gray-700/50",
};

type FilterTab = "activas" | "todas";

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "recién";
  if (mins === 1) return "hace 1 min";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours}h ${mins % 60}min`;
}

export default function ComandasPage() {
  const [orders, setOrders] = useState<ComandaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterTab>("activas");
  const [, setTick] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIds = useRef<Set<number> | null>(null);

  const playNewOrderBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.25);
      });
      setTimeout(() => ctx.close(), 1000);
    } catch (e) {
      console.error("No se pudo reproducir el sonido:", e);
    }
  }, [soundEnabled]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        const newOrders: ComandaOrder[] = data.orders || [];

        if (knownOrderIds.current === null) {
          // Primera carga: solo memorizar, no sonar
          knownOrderIds.current = new Set(newOrders.map((o) => o.id));
        } else {
          const hasNewOrder = newOrders.some((o) => !knownOrderIds.current!.has(o.id));
          if (hasNewOrder) playNewOrderBeep();
          knownOrderIds.current = new Set(newOrders.map((o) => o.id));
        }

        setOrders(newOrders);
      }
    } catch (error) {
      console.error("Failed to fetch comandas:", error);
    } finally {
      setLoading(false);
    }
  }, [playNewOrderBeep]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Re-render every 15s just to refresh the "hace X min" labels
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const handleAdvanceItem = async (order: ComandaOrder, item: ComandaItem) => {
    const next = STATUS_FLOW[item.status].next;
    if (!next) return;

    setUpdatingItemId(item.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", status: next }),
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error("Failed to update item status:", error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleMarkAllReady = async (order: ComandaOrder) => {
    const pending = order.items.filter((i) => i.status === "pendiente" || i.status === "preparando");
    setUpdatingItemId(-1);
    try {
      await Promise.all(
        pending.map((item) =>
          fetch(`/api/orders/${order.id}/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set_status", status: "listo" }),
          })
        )
      );
      fetchOrders();
    } catch (error) {
      console.error("Failed to mark all ready:", error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Oldest tickets first, like a real kitchen rail
  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [orders]
  );

  const visibleOrders = useMemo(() => {
    return sortedOrders
      .map((o) => ({
        ...o,
        _pendingCount: o.items.filter((i) => i.status !== "entregado").length,
      }))
      .filter((o) => o.items.length > 0)
      .filter((o) => (filter === "activas" ? o._pendingCount > 0 : true));
  }, [sortedOrders, filter]);

  const totalPendingItems = sortedOrders.reduce(
    (sum, o) => sum + o.items.filter((i) => i.status !== "entregado").length,
    0
  );

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Comandas</h1>
              <p className="text-sm text-gray-400 mt-1">
                Pedidos tomados por los meseros, en tiempo real
              </p>
            </div>

            <div className="flex items-center gap-3">
              {totalPendingItems > 0 && (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-warning/10 text-warning border border-warning/30">
                  {totalPendingItems} item{totalPendingItems !== 1 ? "s" : ""} por atender
                </span>
              )}
              <button
                onClick={() => setSoundEnabled((s) => !s)}
                title={soundEnabled ? "Silenciar notificaciones" : "Activar sonido"}
                className="btn btn-outline btn-sm px-3"
              >
                {soundEnabled ? "🔔" : "🔕"}
              </button>
              <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
                <button
                  onClick={() => setFilter("activas")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-smooth ${
                    filter === "activas" ? "bg-primary text-white" : "text-gray-400 hover:text-foreground"
                  }`}
                >
                  Activas
                </button>
                <button
                  onClick={() => setFilter("todas")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-smooth ${
                    filter === "todas" ? "bg-primary text-white" : "text-gray-400 hover:text-foreground"
                  }`}
                >
                  Todas
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="w-full h-64" />
              ))}
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="card text-center text-gray-400 py-16">
              <p className="text-lg">
                {filter === "activas" ? "No hay comandas pendientes 🎉" : "Aún no hay pedidos registrados"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleOrders.map((order) => {
                const isNew = Date.now() - new Date(order.created_at).getTime() < 90_000;
                const allDelivered = order.items.every((i) => i.status === "entregado");
                const hasPendingOrPreparing = order.items.some(
                  (i) => i.status === "pendiente" || i.status === "preparando"
                );

                const borderClass = allDelivered
                  ? "border-gray-700"
                  : hasPendingOrPreparing
                  ? "border-warning/50"
                  : "border-success/50";

                return (
                  <div
                    key={order.id}
                    className={`card-sm !p-0 overflow-hidden border-2 ${borderClass} flex flex-col`}
                  >
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-black/20">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-foreground">Mesa {order.table_number}</span>
                          {isNew && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-white animate-pulse">
                              Nueva
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          Mesero: {order.waiter_name || "—"} · {timeAgo(order.created_at)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary whitespace-nowrap">
                        {formatCOP(Number(order.total_amount))}
                      </span>
                    </div>

                    <div className="p-4 space-y-2 flex-1">
                      {order.items.map((item) => {
                        const cfg = STATUS_FLOW[item.status];
                        const isUpdating = updatingItemId === item.id || updatingItemId === -1;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 bg-background/60 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p
                                className={`font-medium truncate ${
                                  item.status === "entregado" ? "text-gray-500 line-through" : "text-foreground"
                                }`}
                              >
                                {item.quantity}x {item.product.name}
                              </p>
                              <span
                                className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[item.status]}`}
                              >
                                {cfg.label}
                              </span>
                            </div>
                            {cfg.next && (
                              <button
                                onClick={() => handleAdvanceItem(order, item)}
                                disabled={isUpdating}
                                className="btn btn-sm btn-outline whitespace-nowrap disabled:opacity-50 shrink-0"
                              >
                                {isUpdating ? "..." : cfg.actionLabel}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {hasPendingOrPreparing && (
                      <div className="p-3 border-t border-border">
                        <button
                          onClick={() => handleMarkAllReady(order)}
                          disabled={updatingItemId === -1}
                          className="btn btn-primary btn-sm w-full disabled:opacity-50"
                        >
                          {updatingItemId === -1 ? "Actualizando..." : "Marcar todo listo"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
