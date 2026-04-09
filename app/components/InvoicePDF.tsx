"use client";

import jsPDF from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}

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

export function generateInvoicePDF(order: Order) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229); // Indigo color
  doc.text("FACTURA", pageWidth / 2, yPosition, { align: "center" });

  // Info del bar
  yPosition += 15;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Bar: ${order.location_name}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Número de Factura: #${order.id}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Mesa: ${order.table_number}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Fecha: ${new Date(order.created_at).toLocaleDateString("es-ES")}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Hora: ${new Date(order.created_at).toLocaleTimeString("es-ES")}`, 20, yPosition);

  // Mesero info
  yPosition += 10;
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text("MESERO RESPONSABLE", 20, yPosition);
  yPosition += 5;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Nombre: ${order.waiter_name}`, 20, yPosition);
  yPosition += 4;
  doc.text(`Email: ${order.waiter_email}`, 20, yPosition);

  // Modificador info si existe
  if (order.modifier_name && order.modifier_name !== order.waiter_name) {
    yPosition += 8;
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229);
    doc.text("ÚLTIMA MODIFICACIÓN POR", 20, yPosition);
    yPosition += 5;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Nombre: ${order.modifier_name}`, 20, yPosition);
    yPosition += 4;
    doc.text(`Email: ${order.modifier_email}`, 20, yPosition);
    yPosition += 4;
    doc.text(`Fecha: ${new Date(order.updated_at).toLocaleDateString("es-ES")} ${new Date(order.updated_at).toLocaleTimeString("es-ES")}`, 20, yPosition);
  }

  // Items table
  yPosition += 15;
  const tableData = order.items.map((item) => [
    item.product_name,
    item.quantity.toString(),
    `$${Number(item.price).toFixed(2)}`,
    `$${(Number(item.price) * item.quantity).toFixed(2)}`,
  ]);

  doc.autoTable({
    head: [["Producto", "Cantidad", "Precio Unit.", "Subtotal"]],
    body: tableData,
    startY: yPosition,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  // Total
  yPosition = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: $${Number(order.total_amount).toFixed(2)}`, pageWidth - 20, yPosition, {
    align: "right",
  });

  // Status
  yPosition += 10;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.text(`Estado: ${order.status.toUpperCase()}`, pageWidth - 20, yPosition, {
    align: "right",
  });

  // Footer
  yPosition = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generado el ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}`,
    pageWidth / 2,
    yPosition,
    { align: "center" }
  );

  return doc;
}

export function downloadInvoice(order: Order) {
  const doc = generateInvoicePDF(order);
  doc.save(`factura-${order.id}.pdf`);
}
