"use client";

/**
 * Ticket térmico 58 mm (PT-210 y similares).
 * HTML mínimo + monospace para el diálogo de impresión de Android/Bluetooth.
 */

export interface OrderItem {
  id?: number;
  product_name: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface Order {
  id: number;
  table_number?: string;
  waiter_name?: string;
  waiter_email?: string;
  modifier_name?: string;
  modifier_email?: string;
  total_amount: number;
  subtotal_amount?: number | null;
  tax_amount?: number;
  tip_amount?: number;
  discount_amount?: number;
  discount_reason?: string | null;
  payment_method?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  location_name?: string;
  ticket_number?: string | null;
  order_type?: string | null;
  client_name?: string | null;
  customer_notes?: string | null;
  items: OrderItem[];
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

/** Trunca nombres largos para 58 mm */
function trunc(s: string, n = 20): string {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/**
 * Ticket de texto/HTML ultra simple para impresoras térmicas Bluetooth 58 mm.
 */
export function buildThermalTicketHTML(order: Order): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("es-CO");
  const timeStr = date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isSS =
    order.order_type === "self_service" || Boolean(order.ticket_number);
  const title = isSS
    ? `Ficho ${order.ticket_number || "#" + order.id}`
    : `Mesa ${order.table_number || "—"}`;
  const docTitle = isSS
    ? `Ticket ${order.ticket_number || order.id}`
    : `Factura #${order.id}`;

  const subtotal =
    order.subtotal_amount != null
      ? Number(order.subtotal_amount)
      : order.items.reduce(
          (sum, i) => sum + Number(i.price) * Number(i.quantity),
          0
        );
  const discount = Number(order.discount_amount || 0);
  const tax = Number(order.tax_amount || 0);
  const tip = Number(order.tip_amount || 0);

  const itemLines = order.items
    .map((item) => {
      const name = trunc(item.product_name, 18);
      const qty = Number(item.quantity) || 0;
      const line = formatCOP(Number(item.price) * qty);
      const notes = item.notes
        ? `<div class="note">* ${trunc(String(item.notes), 28)}</div>`
        : "";
      return `<div class="line"><span>${qty}x ${name}</span><span>${line}</span></div>${notes}`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${docTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #fff;
    color: #000;
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page {
    size: 58mm auto;
    margin: 2mm;
  }
  @media print {
    html, body { width: 58mm; margin: 0; }
    .no-print { display: none !important; }
  }
  .ticket {
    width: 52mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 2mm 1mm 6mm;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 16px; font-weight: 900; }
  .sep {
    border: none;
    border-top: 1px dashed #000;
    margin: 4px 0;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    margin: 2px 0;
  }
  .note { font-size: 10px; padding-left: 6px; }
  .total { font-size: 14px; font-weight: 900; margin-top: 2px; }
  .muted { font-size: 10px; }
  .actions {
    max-width: 280px;
    margin: 16px auto;
    padding: 12px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
  }
  .actions button {
    width: 100%;
    padding: 12px;
    margin: 6px 0;
    font-size: 16px;
    border-radius: 8px;
    border: 1px solid #333;
    background: #111;
    color: #fff;
  }
  .actions .secondary {
    background: #fff;
    color: #111;
  }
</style>
</head>
<body>
  <div class="actions no-print">
    <p class="center bold">Ticket térmico 58 mm</p>
    <p class="muted center">Usa este botón con tu PT-210 / Bluetooth</p>
    <button type="button" onclick="window.print()">Imprimir ticket</button>
    <button type="button" class="secondary" onclick="window.close()">Cerrar</button>
  </div>

  <div class="ticket">
    <div class="center bold">${trunc(order.location_name || "Bar Manager", 24)}</div>
    <div class="center muted">${dateStr} ${timeStr}</div>
    <div class="center big" style="margin:6px 0;">${title}</div>
    ${
      !isSS
        ? `<div class="center muted">Factura #${order.id}</div>`
        : ""
    }
    ${
      order.client_name
        ? `<div>Cliente: ${trunc(order.client_name, 22)}</div>`
        : ""
    }
    ${
      order.waiter_name
        ? `<div class="muted">Mesero: ${trunc(order.waiter_name, 20)}</div>`
        : ""
    }
    <hr class="sep"/>
    ${itemLines || "<div class='muted'>Sin ítems</div>"}
    <hr class="sep"/>
    <div class="line"><span>Subtotal</span><span>${formatCOP(subtotal)}</span></div>
    ${
      discount > 0
        ? `<div class="line"><span>Descuento</span><span>-${formatCOP(discount)}</span></div>`
        : ""
    }
    ${
      tax > 0
        ? `<div class="line"><span>IVA</span><span>${formatCOP(tax)}</span></div>`
        : ""
    }
    ${
      tip > 0
        ? `<div class="line"><span>Propina</span><span>${formatCOP(tip)}</span></div>`
        : ""
    }
    <div class="line total"><span>TOTAL</span><span>${formatCOP(
      Number(order.total_amount)
    )}</span></div>
    <hr class="sep"/>
    ${
      order.payment_method
        ? `<div class="center">Pago: ${
            PAYMENT_LABELS[order.payment_method] || order.payment_method
          }</div>`
        : ""
    }
    ${
      order.customer_notes
        ? `<div class="note">Nota: ${trunc(String(order.customer_notes), 40)}</div>`
        : ""
    }
    <div class="center muted" style="margin-top:8px;">¡Gracias por su visita!</div>
  </div>
</body>
</html>`;
}

/** Abre ticket térmico en nueva ventana (el usuario confirma imprimir). */
export function downloadInvoice(order: Order): void {
  const html = buildThermalTicketHTML(order);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=320,height=640");
  if (win) {
    win.focus();
  } else {
    // Popup bloqueado: navegar en la misma pestaña
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** @deprecated alias */
export function generateInvoicePDF(order: Order) {
  downloadInvoice(order);
}
