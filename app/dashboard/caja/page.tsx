"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { onMoneyKeyInput, parseMoneyInput } from "@/lib/money-input";
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

interface CashSession {
  id: number;
  opening_amount: number;
  opened_at: string;
  opened_by_name: string | null;
  closed_by_name?: string | null;
  closing_amount?: number | null;
  expected_amount?: number | null;
  difference?: number | null;
  closed_at?: string | null;
  notes?: string | null;
}

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

export default function CajaPage() {
  const { user } = useAuth();
  const isCashier = user?.role === "cashier";

  const [open, setOpen] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingAmount, setClosingAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [tickets, setTickets] = useState<TodayTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/cash-sessions");
      if (res.ok) {
        const data = await res.json();
        setOpen(data.open);
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    if (!isCashier) return;
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/cashier/today-tickets");
      if (res.ok) {
        const data = await res.json();
        setTickets(data.orders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isCashier) fetchTickets();
  }, [isCashier]);

  const handleOpen = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const amount = parseMoneyInput(openingAmount);
      const res = await fetch("/api/cash-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingAmount: amount }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpeningAmount("0");
        fetchData();
      } else {
        setError(data.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!open) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cash-sessions/${open.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingAmount: parseMoneyInput(closingAmount),
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setClosingAmount("");
        setNotes("");
        fetchData();
      } else {
        setError(data.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!ticketSearch.trim()) return true;
    const q = ticketSearch.trim().toLowerCase();
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

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
          <h1 className="text-4xl font-bold text-foreground">Caja</h1>

          {error && (
            <div className="bg-error/10 border border-error text-error text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-gray-400">Cargando…</p>
          ) : open ? (
            <div className="card space-y-4">
              <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-success/10 text-success">
                Turno abierto
              </span>
              <p className="text-sm text-gray-400">
                Abierto por {open.opened_by_name} ·{" "}
                {new Date(open.opened_at).toLocaleString("es-CO")}
              </p>
              <p className="text-lg">
                Base:{" "}
                <strong>{formatCOP(Number(open.opening_amount))}</strong>
              </p>
              <div className="space-y-3 border-t border-border pt-4">
                <label className="block text-sm font-medium">
                  Monto contado al cerrar
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input w-full"
                  placeholder="Ej: 350.000"
                  value={closingAmount}
                  onChange={(e) =>
                    setClosingAmount(onMoneyKeyInput(e.target.value))
                  }
                />
                <label className="block text-sm font-medium">Notas</label>
                <input
                  type="text"
                  className="input w-full"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
                <button
                  onClick={handleClose}
                  disabled={submitting || !closingAmount}
                  className="btn btn-primary w-full disabled:opacity-50"
                >
                  {submitting ? "Cerrando..." : "Cerrar turno y hacer arqueo"}
                </button>
              </div>
            </div>
          ) : (
            <div className="card space-y-4">
              <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-warning/10 text-warning">
                Sin turno abierto
              </span>
              <label className="block text-sm font-medium">
                Monto inicial en caja
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="input w-full"
                placeholder="Ej: 100.000"
                value={openingAmount}
                onChange={(e) =>
                  setOpeningAmount(onMoneyKeyInput(e.target.value))
                }
              />
              <button
                onClick={handleOpen}
                disabled={submitting}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {submitting ? "Abriendo..." : "Abrir turno de caja"}
              </button>
            </div>
          )}

          {/* Solo cajero: reimprimir tickets del día */}
          {isCashier && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">Tickets de hoy</h2>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={fetchTickets}
                  disabled={ticketsLoading}
                >
                  {ticketsLoading ? "…" : "Actualizar"}
                </button>
              </div>
              <p className="text-sm text-gray-400">
                Reimprime un ticket si falló la impresora o el cliente pide
                otra copia. Solo cobros de hoy de tu local.
              </p>
              <input
                type="search"
                className="input w-full"
                placeholder="Buscar mesa, ficho o #pedido…"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
              />
              {ticketsLoading && tickets.length === 0 ? (
                <p className="text-gray-400 text-sm">Cargando tickets…</p>
              ) : filteredTickets.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No hay cobros de hoy para mostrar.
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredTickets.map((t) => {
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
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Historial de turnos</h2>
              <div className="space-y-3">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="card-sm flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm text-gray-400">
                        {new Date(h.opened_at).toLocaleDateString("es-CO")} ·{" "}
                        {h.opened_by_name} → {h.closed_by_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Notas: {h.notes || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          Number(h.difference) === 0
                            ? "text-success"
                            : Number(h.difference) > 0
                              ? "text-primary"
                              : "text-error"
                        }`}
                      >
                        {Number(h.difference) > 0 ? "+" : ""}
                        {formatCOP(Number(h.difference || 0))}
                      </p>
                      <p className="text-xs text-gray-500">
                        Contado {formatCOP(Number(h.closing_amount || 0))} /
                        Esperado {formatCOP(Number(h.expected_amount || 0))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
