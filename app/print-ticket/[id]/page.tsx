"use client";

import { useEffect, useState, use as usePromise } from "react";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

interface TicketData {
  ticketNumber: string;
  clientName?: string;
  customerNotes?: string;
  total: number;
  createdAt: string;
  locationName?: string | null;
  locationAddress?: string | null;
  cashierName?: string | null;
  paymentMethod?: string | null;
  items: { name: string; quantity: number; notes?: string; subtotal: number }[];
}

export default function PrintTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${id}/ticket`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Error");
        return data;
      })
      .then((data) => setTicket(data))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <p style={{ padding: 16, color: "red", fontFamily: "sans-serif" }}>
        {error}
      </p>
    );
  }

  if (!ticket) {
    return (
      <p style={{ padding: 16, fontFamily: "sans-serif" }}>Cargando ticket…</p>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: #fff;
          color: #000;
          font-family: "Courier New", Courier, monospace;
          font-size: 12px;
          line-height: 1.25;
        }
        @page { size: 58mm auto; margin: 2mm; }
        @media print {
          html, body { width: 58mm; }
          .no-print { display: none !important; }
        }
        .ticket { width: 52mm; margin: 0 auto; padding: 2mm 1mm 8mm; }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .big { font-size: 18px; font-weight: 900; }
        .sep { border: none; border-top: 1px dashed #000; margin: 4px 0; }
        .line { display: flex; justify-content: space-between; gap: 4px; margin: 2px 0; }
        .note { font-size: 10px; padding-left: 6px; }
        .muted { font-size: 10px; }
        .actions {
          max-width: 300px;
          margin: 12px auto;
          padding: 12px;
          font-family: system-ui, sans-serif;
          font-size: 14px;
        }
        .actions button {
          width: 100%;
          padding: 14px;
          margin-top: 8px;
          font-size: 16px;
          border-radius: 8px;
          border: 1px solid #333;
          background: #111;
          color: #fff;
        }
      `}</style>

      <div className="actions no-print">
        <p className="center bold" style={{ fontFamily: "system-ui" }}>
          Ticket 58 mm — {ticket.ticketNumber}
        </p>
        <p className="muted center" style={{ fontFamily: "system-ui" }}>
          Elige tu impresora PT-210 / Bluetooth y confirma. No se imprime solo
          para evitar trabajos colgados.
        </p>
        <button type="button" onClick={() => window.print()}>
          Imprimir ticket
        </button>
      </div>

      <div className="ticket">
        {ticket.locationName && (
          <div className="center bold">{ticket.locationName}</div>
        )}
        {ticket.locationAddress && (
          <div className="center muted">{ticket.locationAddress}</div>
        )}
        <div className="center big" style={{ margin: "6px 0" }}>
          {ticket.ticketNumber}
        </div>
        <div className="center muted">
          {new Date(ticket.createdAt).toLocaleString("es-CO")}
        </div>
        {ticket.cashierName && (
          <div className="center muted">Cajero: {ticket.cashierName}</div>
        )}
        {ticket.clientName && <div>Cliente: {ticket.clientName}</div>}
        <hr className="sep" />
        {ticket.items.map((item, i) => (
          <div key={i}>
            <div className="line">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{formatCOP(item.subtotal)}</span>
            </div>
            {item.notes && <div className="note">* {item.notes}</div>}
          </div>
        ))}
        <hr className="sep" />
        {ticket.customerNotes && (
          <div className="note">Nota: {ticket.customerNotes}</div>
        )}
        <div className="line" style={{ fontWeight: 900, fontSize: 14 }}>
          <span>TOTAL</span>
          <span>{formatCOP(ticket.total)}</span>
        </div>
        {ticket.paymentMethod && (
          <div className="center muted" style={{ marginTop: 4 }}>
            Pago: {ticket.paymentMethod}
          </div>
        )}
        <div className="center muted" style={{ marginTop: 10 }}>
          ¡Gracias por su visita!
        </div>
      </div>
    </>
  );
}
