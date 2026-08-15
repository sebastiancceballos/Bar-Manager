"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { onMoneyKeyInput, parseMoneyInput } from "@/lib/money-input";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

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

export default function CajaPage() {
  const [open, setOpen] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closingAmount, setClosingAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, []);

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
        body: JSON.stringify({ closingAmount: parseMoneyInput(closingAmount), notes }),
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

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Turno de Caja</h1>
            <p className="text-sm text-gray-400 mt-1">Apertura y cierre de caja con arqueo</p>
          </div>

          {error && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="card animate-pulse h-40" />
          ) : open ? (
            <div className="card space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-success/10 text-success">Turno abierto</span>
                  <p className="text-sm text-gray-400 mt-2">
                    Abierto por {open.opened_by_name} el {new Date(open.opened_at).toLocaleString("es-CO")}
                  </p>
                </div>
                <p className="text-2xl font-bold text-primary">{formatCOP(Number(open.opening_amount))}</p>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <label className="block text-sm font-medium">Efectivo contado al cerrar</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input w-full"
                  placeholder="Ej: 250.000"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(onMoneyKeyInput(e.target.value))}
                />
                <label className="block text-sm font-medium">Notas (opcional)</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Observaciones del cierre..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <button
                  onClick={handleClose}
                  disabled={submitting || closingAmount === ""}
                  className="btn btn-primary w-full disabled:opacity-50"
                >
                  {submitting ? "Cerrando..." : "Cerrar turno y hacer arqueo"}
                </button>
              </div>
            </div>
          ) : (
            <div className="card space-y-4">
              <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-warning/10 text-warning">Sin turno abierto</span>
              <label className="block text-sm font-medium">Monto inicial en caja</label>
              <input
                type="text"
                inputMode="numeric"
                className="input w-full"
                placeholder="Ej: 100.000"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(onMoneyKeyInput(e.target.value))}
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

          {history.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Historial</h2>
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="card-sm flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-400">
                        {new Date(h.opened_at).toLocaleDateString("es-CO")} · {h.opened_by_name} → {h.closed_by_name}
                      </p>
                      <p className="text-xs text-gray-500">Notas: {h.notes || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${Number(h.difference) === 0 ? "text-success" : Number(h.difference) > 0 ? "text-primary" : "text-error"}`}>
                        {Number(h.difference) > 0 ? "+" : ""}{formatCOP(Number(h.difference || 0))}
                      </p>
                      <p className="text-xs text-gray-500">
                        Contado {formatCOP(Number(h.closing_amount || 0))} / Esperado {formatCOP(Number(h.expected_amount || 0))}
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
