import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Público, pero por diseño solo se puede consultar con el UUID impredecible
// (public_token), nunca con el número de ficho secuencial. Así un cliente no
// puede ver el pedido de otro cambiando un número en la URL.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const orders = await sql`
      SELECT id, ticket_number, status, total_amount, client_name, created_at, updated_at
      FROM orders
      WHERE public_token = ${token} AND order_type = 'self_service'
      LIMIT 1
    `;
    const order = orders[0];

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const items = await sql`
      SELECT oi.quantity, oi.notes, p.name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${order.id}
    `;

    return NextResponse.json(
      {
        ticketNumber: order.ticket_number,
        status: order.status,
        total: order.total_amount,
        clientName: order.client_name,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items: items.map((i: any) => ({ name: i.name, quantity: i.quantity, notes: i.notes })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get tracking error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
