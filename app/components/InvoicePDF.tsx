"use client";

interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  table_number: string;
  waiter_name: string;
  waiter_email: string;
  modifier_name?: string;
  modifier_email?: string;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  location_name: string;
  items: OrderItem[];
}

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);

function buildReceiptHTML(order: Order): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("es-CO");
  const timeStr = date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const divider = "--------------------------------";

  const itemsRows = order.items
    .map((item) => {
      const subtotal = formatCOP(Number(item.price) * item.quantity);
      const unitPrice = formatCOP(Number(item.price));
      const name = item.product_name.length > 18
        ? item.product_name.substring(0, 18)
        : item.product_name;
      return `
        <tr>
          <td style="text-align:left;padding:1px 0;">${name}</td>
          <td style="text-align:center;padding:1px 2px;">${item.quantity}</td>
          <td style="text-align:right;padding:1px 0;">${unitPrice}</td>
          <td style="text-align:right;padding:1px 0;">${subtotal}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Factura #${order.id}</title>
  <style>
    @page {
      margin: 0;
      size: 58mm auto;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 58mm;
      padding: 4mm 3mm;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .title { font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 2px; }
    .bar-name { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; text-align: left; padding: 1px 0; border-bottom: 1px solid #000; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3), th:nth-child(4) { text-align: right; }
    td { font-size: 10px; vertical-align: top; }
    .total-row { font-size: 13px; font-weight: bold; }
    .footer { font-size: 9px; text-align: center; margin-top: 6px; }
    @media print {
      body { width: 58mm; }
    }
  </style>
</head>
<body>
  <div class="bar-name">${order.location_name.toUpperCase()}</div>
  <div class="title">FACTURA</div>
  <div class="center">#${order.id}</div>
  <div class="divider"></div>
  <div>Mesa: <span class="bold">${order.table_number}</span></div>
  <div>Fecha: ${dateStr} ${timeStr}</div>
  <div>Mesero: ${order.waiter_name}</div>
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th>Cant</th>
        <th>P.Unit</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>
  <div class="divider"></div>
  <table>
    <tr class="total-row">
      <td colspan="3" style="text-align:right;padding-right:4px;">TOTAL:</td>
      <td style="text-align:right;">${formatCOP(Number(order.total_amount))}</td>
    </tr>
  </table>
  <div class="divider"></div>
  <div class="footer">
    <div>Estado: ${order.status.toUpperCase()}</div>
    <div>Generado: ${new Date().toLocaleDateString("es-CO")}</div>
    <div>¡Gracias por su visita!</div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

export function downloadInvoice(order: Order): void {
  const html = buildReceiptHTML(order);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=300,height=600");
  if (win) {
    win.focus();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Keep for backward compat if anything imports generateInvoicePDF
export function generateInvoicePDF(order: Order) {
  downloadInvoice(order);
}