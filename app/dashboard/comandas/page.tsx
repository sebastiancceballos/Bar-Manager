"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Skeleton } from "@/app/components/Skeleton";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);

type ItemStatus = "pendiente" | "preparando" | "listo" | "entregado";
type OrderSource = "dine_in" | "self_service";
type FilterTab = "activas" | "todas" | "mesas" | "autoservicio";

interface ComandaItem {
  id: number;
  product_id?: number;
  quantity: number;
  price: number;
  status: ItemStatus;
  notes?: string;
  product: {
    name: string;
    price: number;
    category?: string;
  };
}

interface UnifiedOrder {
  id: number;
  source: OrderSource;
  table_number?: string;
  ticket_number?: string;
  client_name?: string;
  waiter_name: string | null;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  /** Solo autoservicio: PAID | PREPARING | READY */
  ssStatus?: string;
  items: ComandaItem[];
}

const STATUS_FLOW: Record<
  ItemStatus,
  { next: ItemStatus | null; label: string; actionLabel: string }
> = {
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

const SS_STATUS_LABEL: Record<string, string> = {
  PAID: "Pagado — por preparar",
  PREPARING: "En preparación",
  READY: "Listo — esperando entrega",
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "recién";
  if (mins === 1) return "hace 1 min";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours}h ${mins % 60}min`;
}

function mapDineIn(raw: any): UnifiedOrder {
  return {
    id: raw.id,
    source: "dine_in",
    table_number: raw.table_number,
    waiter_name: raw.waiter_name ?? null,
    total_amount: Number(raw.total_amount) || 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    items: (raw.items || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: Number(item.price),
      status: (item.status || "pendiente") as ItemStatus,
      notes: item.notes,
      product: item.product || {
        name: item.product_name || "Producto",
        price: Number(item.price),
        category: item.category,
      },
    })),
  };
}

function mapSelfService(raw: any): UnifiedOrder {
  // Map order-level SS status to a synthetic item status for "activas" filter
  const ss = raw.status as string;
  const itemStatusFromOrder: ItemStatus =
    ss === "READY" ? "listo" : ss === "PREPARING" ? "preparando" : "pendiente";

  return {
    id: raw.id,
    source: "self_service",
    ticket_number: raw.ticket_number,
    client_name: raw.client_name,
    waiter_name: raw.client_name ? `Cliente: ${raw.client_name}` : "Autoservicio",
    total_amount: Number(raw.total_amount) || 0,
    created_at: raw.created_at,
    ssStatus: ss,
    items: (raw.items || []).map((item: any, idx: number) => ({
      id: item.id ?? idx,
      quantity: item.quantity,
      price: Number(item.price) || 0,
      status: itemStatusFromOrder,
      notes: item.notes,
      product: {
        name: item.name || item.product_name || "Producto",
        price: Number(item.price) || 0,
      },
    })),
  };
}

export default function ComandasPage() {
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterTab>("activas");
  const [, setTick] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIds = useRef<Set<number> | null>(null);

  const playNewOrderBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.start();
      o.stop(ctx.currentTime + 0.15);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const [dineRes, paidRes, prepRes, readyRes] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/self-service/orders?status=PAID", { cache: "no-store" }),
        fetch("/api/self-service/orders?status=PREPARING", { cache: "no-store" }),
        fetch("/api/self-service/orders?status=READY", { cache: "no-store" }),
      ]);

      const dineData = dineRes.ok ? await dineRes.json() : { orders: [] };
      const paidData = paidRes.ok ? await paidRes.json() : { orders: [] };
      const prepData = prepRes.ok ? await prepRes.json() : { orders: [] };
      const readyData = readyRes.ok ? await readyRes.json() : { orders: [] };

      const dineIn: UnifiedOrder[] = (dineData.orders || []).map(mapDineIn);
      const selfService: UnifiedOrder[] = [
        ...(paidData.orders || []),
        ...(prepData.orders || []),
        ...(readyData.orders || []),
      ].map(mapSelfService);

      const merged = [...dineIn, ...selfService];

      // Sonido solo para pedidos nuevos (cualquier fuente)
      const ids = new Set(merged.map((o) => o.id));
      if (knownOrderIds.current !== null && soundEnabled) {
        for (const id of ids) {
          if (!knownOrderIds.current.has(id)) {
            playNewOrderBeep();
            break;
          }
        }
      }
      knownOrderIds.current = ids;

      setOrders(merged);
    } catch (error) {
      console.error("Failed to fetch comandas:", error);
    } finally {
      setLoading(false);
    }
  }, [playNewOrderBeep, soundEnabled]);

  useEffect(() => {
    fetchOrders();
    const poll = setInterval(fetchOrders, 4000);
    const tick = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [fetchOrders]);

  const handleAdvanceItem = async (order: UnifiedOrder, item: ComandaItem) => {
    if (order.source !== "dine_in") return;
    const next = STATUS_FLOW[item.status].next;
    if (!next) return;
    setUpdatingItemId(item.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", status: next }),
      });
      if (res.ok) await fetchOrders();
    } catch (error) {
      console.error("Failed to update item status:", error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleMarkAllReady = async (order: UnifiedOrder) => {
    if (order.source !== "dine_in") return;
    const pending = order.items.filter(
      (i) => i.status === "pendiente" || i.status === "preparando"
    );
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
      await fetchOrders();
    } catch (error) {
      console.error("Failed to mark all ready:", error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleSelfServiceAdvance = async (order: UnifiedOrder) => {
    if (order.source !== "self_service" || !order.ssStatus) return;
    const next =
      order.ssStatus === "PAID"
        ? "PREPARING"
        : order.ssStatus === "PREPARING"
          ? "READY"
          : null;
    if (!next) return;
    setBusyOrderId(order.id);
    try {
      const res = await fetch(`/api/self-service/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error(data.error || "Error al actualizar pedido");
      }
      await fetchOrders();
    } catch (error) {
      console.error("Failed to advance self-service order:", error);
    } finally {
      setBusyOrderId(null);
    }
  };

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [orders]
  );

  const visibleOrders = useMemo(() => {
    return sortedOrders
      .map((o) => {
        const isActive =
          o.source === "self_service"
            ? o.ssStatus === "PAID" || o.ssStatus === "PREPARING"
            : o.items.some((i) => i.status !== "entregado");
        return { ...o, _isActive: isActive };
      })
      .filter((o) => o.items.length > 0)
      .filter((o) => {
        if (filter === "activas") return o._isActive;
        if (filter === "mesas") return o.source === "dine_in";
        if (filter === "autoservicio") return o.source === "self_service";
        return true;
      });
  }, [sortedOrders, filter]);

  const totalPending = sortedOrders.filter((o) =>
    o.source === "self_service"
      ? o.ssStatus === "PAID" || o.ssStatus === "PREPARING"
      : o.items.some((i) => i.status !== "entregado")
  ).length;

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "activas", label: "Activas" },
    { key: "mesas", label: "Mesas" },
    { key: "autoservicio", label: "Autoservicio" },
    { key: "todas", label: "Todas" },
  ];

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Comandas</h1>
              <p className="text-sm text-gray-400 mt-1">
                Mesas y autoservicio en un solo panel · actualización en vivo
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {totalPending > 0 && (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-warning/10 text-warning border border-warning/30">
                  {totalPending} comanda{totalPending !== 1 ? "s" : ""} activa
                  {totalPending !== 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={() => setSoundEnabled((s) => !s)}
                title={soundEnabled ? "Silenciar notificaciones" : "Activar sonido"}
                className="btn btn-outline btn-sm px-3"
              >
                {soundEnabled ? "🔔" : "🔕"}
              </button>
              <div className="flex gap-1 bg-card border border-border rounded-lg p-1 flex-wrap">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-smooth ${
                      filter === f.key
                        ? "bg-primary text-white"
                        : "text-gray-400 hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
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
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">No hay comandas en esta vista</p>
              <p className="text-sm mt-2">Los pedidos de mesa y fichos pagados aparecerán aquí</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleOrders.map((order) => {
                const isSS = order.source === "self_service";
                const hasPendingOrPreparing = order.items.some(
                  (i) => i.status === "pendiente" || i.status === "preparando"
                );
                const title = isSS
                  ? `Ficho ${order.ticket_number || "#" + order.id}`
                  : `Mesa ${order.table_number}`;
                const ssActionLabel =
                  order.ssStatus === "PAID"
                    ? "Empezar preparación"
                    : order.ssStatus === "PREPARING"
                      ? "Marcar listo"
                      : null;

                return (
                  <div
                    key={`${order.source}-${order.id}`}
                    className={`bg-card border rounded-xl overflow-hidden flex flex-col ${
                      isSS ? "border-primary/40" : "border-border"
                    }`}
                  >
                    <div className="p-4 border-b border-border flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-foreground">{title}</h2>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              isSS
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-card text-gray-400 border-border"
                            }`}
                          >
                            {isSS ? "Autoservicio" : "Mesa"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {timeAgo(order.created_at)} · {order.waiter_name || "—"}
                        </p>
                        {isSS && order.ssStatus && (
                          <p className="text-xs text-primary mt-1 font-medium">
                            {SS_STATUS_LABEL[order.ssStatus] || order.ssStatus}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-success shrink-0">
                        {formatCOP(order.total_amount)}
                      </p>
                    </div>

                    <div className="p-3 space-y-2 flex-1">
                      {order.items.map((item, idx) => {
                        const cfg = STATUS_FLOW[item.status] || STATUS_FLOW.pendiente;
                        const isUpdating =
                          updatingItemId === item.id || updatingItemId === -1;
                        return (
                          <div
                            key={`${order.id}-item-${item.id}-${idx}`}
                            className="flex items-center justify-between gap-2 bg-background/60 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p
                                className={`font-medium truncate ${
                                  item.status === "entregado"
                                    ? "text-gray-500 line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {item.quantity}x {item.product.name}
                              </p>
                              {item.notes && (
                                <p className="text-[11px] text-warning mt-0.5 truncate">
                                  📝 {item.notes}
                                </p>
                              )}
                              {!isSS && (
                                <span
                                  className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[item.status]}`}
                                >
                                  {cfg.label}
                                </span>
                              )}
                            </div>
                            {!isSS && cfg.next && (
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

                    {isSS && ssActionLabel && (
                      <div className="p-3 border-t border-border">
                        <button
                          onClick={() => handleSelfServiceAdvance(order)}
                          disabled={busyOrderId === order.id}
                          className="btn btn-primary btn-sm w-full disabled:opacity-50"
                        >
                          {busyOrderId === order.id ? "Actualizando..." : ssActionLabel}
                        </button>
                      </div>
                    )}

                    {isSS && order.ssStatus === "READY" && (
                      <div className="p-3 border-t border-border">
                        <p className="text-xs text-center text-success font-medium">
                          ✓ Listo — el cajero puede entregarlo
                        </p>
                      </div>
                    )}

                    {!isSS && hasPendingOrPreparing && (
                      <div className="p-3 border-t border-border">
                        <button
                          onClick={() => handleMarkAllReady(order)}
                          disabled={updatingItemId === -1}
                          className="btn btn-primary btn-sm w-full disabled:opacity-50"
                        >
                          {updatingItemId === -1
                            ? "Actualizando..."
                            : "Marcar todo listo"}
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
