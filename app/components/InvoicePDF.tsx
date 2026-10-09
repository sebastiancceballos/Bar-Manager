"use client";

/**
 * Thermal ticket 58 mm (PT-210 and similar).
 * Minimal HTML + monospace for the Android/Bluetooth print dialog.
 */

import { translate, type Locale, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "@/lib/i18n";
import { intlLocale } from "@/lib/format-date";

/** Reads the locale currently selected by the user (falls back to the app default). */
function getCurrentLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === "es" || raw === "en") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

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

const PAYMENT_LABEL_KEYS: Record<string, string> = {
  efectivo: "cashPayment",
  tarjeta: "card",
  transferencia: "transfer",
  otro: "other",
};

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

/** Truncates long names so they fit on a 58 mm ticket */
function trunc(s: string, n = 20): string {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/**
 * Ultra-simple text/HTML ticket for 58 mm Bluetooth thermal printers.
 */
export function buildThermalTicketHTML(order: Order, locale: Locale = getCurrentLocale()): string {
  const tr = (key: string) => translate(locale, key);
  const htmlLang = locale;
  const date = new Date(order.created_at);
  const dateLocale = intlLocale(locale);
  const dateStr = date.toLocaleDateString(dateLocale);
  const timeStr = date.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isSS =
    order.order_type === "self_service" || Boolean(order.ticket_number);
  const title = isSS
    ? `${tr("ticketHash")} ${order.ticket_number || "#" + order.id}`
    : `${tr("table")} ${order.table_number || "—"}`;
  const docTitle = isSS
    ? `${tr("ticketHash")} ${order.ticket_number || order.id}`
    : `${tr("invoiceHash")}${order.id}`;

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
<html lang="${htmlLang}">
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
    <p class="center bold">${tr("thermalTicket58mm")}</p>
    <p class="muted center">${tr("useButtonHint")}</p>
    <button type="button" onclick="window.print()">${tr("printTicketButton")}</button>
    <button type="button" class="secondary" onclick="window.close()">${tr("close")}</button>
  </div>

  <div class="ticket">
    <div class="center bold">${trunc(order.location_name || "Bar Manager", 24)}</div>
    <div class="center muted">${dateStr} ${timeStr}</div>
    <div class="center big" style="margin:6px 0;">${title}</div>
    ${
      !isSS
        ? `<div class="center muted">${tr("invoiceHash")}${order.id}</div>`
        : ""
    }
    ${
      order.client_name
        ? `<div>${tr("customerLabel")}: ${trunc(order.client_name, 22)}</div>`
        : ""
    }
    ${
      order.waiter_name
        ? `<div class="muted">${tr("waiterLabel")}: ${trunc(order.waiter_name, 20)}</div>`
        : ""
    }
    <hr class="sep"/>
    ${itemLines || `<div class='muted'>${tr("noItems")}</div>`}
    <hr class="sep"/>
    <div class="line"><span>${tr("subtotal")}</span><span>${formatCOP(subtotal)}</span></div>
    ${
      discount > 0
        ? `<div class="line"><span>${tr("discount")}</span><span>-${formatCOP(discount)}</span></div>`
        : ""
    }
    ${
      tax > 0
        ? `<div class="line"><span>${tr("tax")}</span><span>${formatCOP(tax)}</span></div>`
        : ""
    }
    ${
      tip > 0
        ? `<div class="line"><span>${tr("tip")}</span><span>${formatCOP(tip)}</span></div>`
        : ""
    }
    <div class="line total"><span>${tr("totalLabel")}</span><span>${formatCOP(
      Number(order.total_amount)
    )}</span></div>
    <hr class="sep"/>
    ${
      order.payment_method
        ? `<div class="center">${tr("paymentLabel")}: ${
            tr(PAYMENT_LABEL_KEYS[order.payment_method]) || order.payment_method
          }</div>`
        : ""
    }
    ${
      order.customer_notes
        ? `<div class="note">${tr("noteLabel")}: ${trunc(String(order.customer_notes), 40)}</div>`
        : ""
    }
    <div class="center muted" style="margin-top:8px;">${tr("thanksForVisit")}</div>
  </div>
</body>
</html>`;
}

/**
 * Opens the 58 mm thermal ticket.
 * By default asks for confirmation: "Print the invoice for…?"
 * Pass { skipConfirm: true } if the user already confirmed in another dialog.
 */
export function downloadInvoice(
  order: Order,
  opts?: { skipConfirm?: boolean }
): void {
  const locale = getCurrentLocale();
  const tr = (key: string) => translate(locale, key);
  const label = order.ticket_number
    ? `${tr("ticketWord")} ${order.ticket_number}`
    : order.table_number
      ? `${tr("table").toLowerCase()} ${order.table_number}`
      : `#${order.id}`;
  const total = formatCOP(Number(order.total_amount) || 0);

  if (!opts?.skipConfirm) {
    const ok = window.confirm(
      `${tr("printInvoiceQuestion")} ${label}?

${tr("totalWord")}: ${total}`
    );
    if (!ok) return;
  }

  const html = buildThermalTicketHTML(order, locale);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=320,height=640");
  if (win) {
    win.focus();
  } else {
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
