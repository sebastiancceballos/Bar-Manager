import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (currentUser.role !== "admin" && currentUser.role !== "owner") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { date } = await params; // YYYY-MM-DD format

    // Get orders for the day with waiter and modifier info
    const result = await sql`
      SELECT 
        o.id,
        o.table_id,
        o.waiter_id,
        o.total_amount,
        o.status,
        o.created_at,
        o.updated_at,
        o.modified_by,
        u.name AS waiter_name,
        u.email AS waiter_email,
        m.name AS modifier_name,
        m.email AS modifier_email,
        t.table_number,
        l.name AS location_name
      FROM orders o
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN users m ON o.modified_by = m.id
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN locations l ON t.location_id = l.id
      WHERE DATE(o.created_at) = ${date}::date
      ORDER BY o.created_at DESC
    `;

    const orders = Array.isArray(result) ? result : [];

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const itemsResult = await sql`
          SELECT 
            oi.id,
            oi.product_id,
            oi.quantity,
            oi.price,
            p.name AS product_name
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ${order.id}
        `;
        
        return {
          ...order,
          items: Array.isArray(itemsResult) ? itemsResult : []
        };
      })
    );

    return NextResponse.json({ orders: ordersWithItems }, { status: 200 });
  } catch (error) {
    console.error("Error fetching daily orders:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
