"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";

interface Shift {
  id: number;
  clock_in: string;
  clock_out: string | null;
}

function formatDuration(start: string, end?: string | null) {
  const ms = new Date(end || Date.now()).getTime() - new Date(start).getTime();
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}min`;
}

export default function TurnoPage() {
  const [open, setOpen] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [, setTick] = useState(0);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/shifts");
      if (res.ok) {
        const data = await res.json();
        setOpen(data.open);
        setHistory(data.history || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const handleToggle = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shifts", { method: "POST" });
      if (res.ok) fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mi Turno</h1>
            <p className="text-sm text-gray-400 mt-1">Marca tu entrada y salida</p>
          </div>

          {loading ? (
            <div className="card animate-pulse h-32" />
          ) : (
            <div className="card text-center space-y-4">
              {open ? (
                <>
                  <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-success/10 text-success">Turno activo</span>
                  <p className="text-4xl font-bold text-foreground">{formatDuration(open.clock_in)}</p>
                  <p className="text-sm text-gray-400">
                    Entrada: {new Date(open.clock_in).toLocaleTimeString("es-CO")}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-gray-700/30 text-gray-400">Sin turno activo</span>
                  <p className="text-gray-400">No has marcado entrada hoy</p>
                </>
              )}
              <button
                onClick={handleToggle}
                disabled={submitting}
                className={`btn w-full disabled:opacity-50 ${open ? "bg-error/10 text-error" : "btn-primary"}`}
              >
                {submitting ? "..." : open ? "Marcar Salida" : "Marcar Entrada"}
              </button>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Últimos turnos</h2>
              <div className="space-y-2">
                {history.map((s) => (
                  <div key={s.id} className="card-sm flex justify-between text-sm">
                    <span>{new Date(s.clock_in).toLocaleDateString("es-CO")}</span>
                    <span className="text-gray-400">
                      {new Date(s.clock_in).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {s.clock_out ? new Date(s.clock_out).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "?"}
                    </span>
                    <span className="font-medium">{formatDuration(s.clock_in, s.clock_out)}</span>
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
