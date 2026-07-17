"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";

interface Reservation {
  id: number;
  customer_name: string;
  phone: string | null;
  party_size: number;
  reservation_time: string;
  status: string;
  notes: string | null;
  table_number: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_show: "No llegó",
};

const STATUS_STYLES: Record<string, string> = {
  confirmada: "bg-primary/10 text-primary",
  cancelada: "bg-error/10 text-error",
  completada: "bg-success/10 text-success",
  no_show: "bg-gray-700/30 text-gray-400",
};

export default function ReservasPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [reservationTime, setReservationTime] = useState("");
  const [notes, setNotes] = useState("");

  const fetchReservations = async () => {
    try {
      const res = await fetch("/api/reservations");
      if (res.ok) {
        const data = await res.json();
        setReservations(data.reservations || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          partySize: parseInt(partySize) || 2,
          reservationTime,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCustomerName("");
        setPhone("");
        setPartySize("2");
        setReservationTime("");
        setNotes("");
        setShowForm(false);
        fetchReservations();
      } else {
        setError(data.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchReservations();
  };

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Reservas</h1>
              <p className="text-sm text-gray-400 mt-1">Próximas reservas de mesa</p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
              {showForm ? "Cancelar" : "Nueva Reserva"}
            </button>
          </div>

          {error && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="card space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre del cliente</label>
                  <input className="input w-full" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Teléfono</label>
                  <input className="input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Número de personas</label>
                  <input type="number" min="1" className="input w-full" value={partySize} onChange={(e) => setPartySize(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fecha y hora</label>
                  <input type="datetime-local" required className="input w-full" value={reservationTime} onChange={(e) => setReservationTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notas</label>
                <input className="input w-full" placeholder="Ej: mesa junto a la ventana" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary w-full disabled:opacity-50">
                {submitting ? "Guardando..." : "Guardar Reserva"}
              </button>
            </form>
          )}

          {loading ? (
            <div className="card animate-pulse h-40" />
          ) : reservations.length === 0 ? (
            <div className="card text-center text-gray-400 py-12">No hay reservas próximas</div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => (
                <div key={r.id} className="card-sm flex justify-between items-center gap-4">
                  <div>
                    <p className="font-semibold">{r.customer_name} · {r.party_size} personas</p>
                    <p className="text-sm text-gray-400">
                      {new Date(r.reservation_time).toLocaleString("es-CO")}
                      {r.table_number ? ` · Mesa ${r.table_number}` : ""}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </p>
                    {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    {r.status === "confirmada" && (
                      <div className="flex gap-1">
                        <button onClick={() => handleStatusChange(r.id, "completada")} className="btn btn-sm btn-outline text-[10px]">Llegó</button>
                        <button onClick={() => handleStatusChange(r.id, "no_show")} className="btn btn-sm btn-outline text-[10px]">No llegó</button>
                        <button onClick={() => handleStatusChange(r.id, "cancelada")} className="btn btn-sm bg-error/10 text-error text-[10px]">Cancelar</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
