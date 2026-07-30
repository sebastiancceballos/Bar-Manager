import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const ALLOWED_ROLES = ["owner", "admin", "cashier", "kitchen"];

// Datos ya formateados para el ticket de 80mm. La impresión en sí se hace
// desde /print-ticket/[id] con window.print() del navegador (sin necesidad
// de node-escpos ni de una impresora de red configurada de antemano).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id);

    const rows = await sql`
      SELECT id, ticket_number, client_name, customer_notes, total_amount, created_at
      FROM orders WHERE id = ${orderId} AND order_type = 'self_service' LIMIT 1
    `;
    const order = rows[0];
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const items = await sql`
      SELECT oi.quantity, oi.notes, oi.price, p.name
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${order.id}
    `;

    return NextResponse.json(
      {
        ticketNumber: order.ticket_number,
        clientName: order.client_name,
        customerNotes: order.customer_notes,
        total: order.total_amount,
        createdAt: order.created_at,
        items: items.map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          notes: i.notes,
          subtotal: Number(i.price) * i.quantity,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
