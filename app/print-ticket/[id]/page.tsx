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
  items: { name: string; quantity: number; notes?: string; subtotal: number }[];
}

export default function PrintTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${id}/ticket`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        setTicket(data);
        // Da tiempo a que el layout de 80mm termine de pintarse antes de
        // abrir el diálogo de impresión del navegador.
        setTimeout(() => window.print(), 300);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p style={{ padding: 16, color: "red" }}>{error}</p>;
  if (!ticket) return <p style={{ padding: 16 }}>Cargando ticket…</p>;

  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; }
        }
        body { background: white; }
      `}</style>
      <div
        style={{
          width: "80mm",
          margin: "0 auto",
          padding: "8px",
          fontFamily: "monospace",
          fontSize: "12px",
          color: "black",
          background: "white",
        }}
      >
        <div style={{ textAlign: "center", fontSize: "28px", fontWeight: 900 }}>{ticket.ticketNumber}</div>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          {new Date(ticket.createdAt).toLocaleString("es-CO")}
        </div>
        {ticket.clientName && <div>Cliente: {ticket.clientName}</div>}
        <hr style={{ border: "none", borderTop: "1px dashed black", margin: "6px 0" }} />
        {ticket.items.map((item, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {item.quantity}× {item.name}
              </span>
              <span>{formatCOP(item.subtotal)}</span>
            </div>
            {item.notes && <div style={{ fontSize: "10px", paddingLeft: 8 }}>* {item.notes}</div>}
          </div>
        ))}
        <hr style={{ border: "none", borderTop: "1px dashed black", margin: "6px 0" }} />
        {ticket.customerNotes && <div style={{ marginBottom: 6 }}>Nota: {ticket.customerNotes}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: "14px" }}>
          <span>TOTAL</span>
          <span>{formatCOP(ticket.total)}</span>
        </div>
      </div>
    </>
  );
}
