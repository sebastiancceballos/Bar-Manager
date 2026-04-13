import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD

    if (!from || !to) {
      return NextResponse.json({ error: "Se requieren fechas from y to" }, { status: 400 });
    }

    // Get user's location
    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id;
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    // Get all closed/paid orders in the date range for this location
    const orders = await sql`
      SELECT
        o.id,
        o.total_amount,
        o.status,
        o.created_at,
        o.closed_at,
        t.table_number,
        u.name AS waiter_name,
        l.name AS location_name
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      JOIN locations l ON t.location_id = l.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE DATE(o.created_at) >= ${from}::date
        AND DATE(o.created_at) <= ${to}::date
        AND o.status IN ('closed', 'paid')
        AND t.location_id = ${locId}
      ORDER BY o.created_at ASC
    `;

    // Get items for each order
    const result = await Promise.all(
      (Array.isArray(orders) ? orders : []).map(async (order) => {
        const items = await sql`
          SELECT
            oi.quantity,
            oi.price,
            p.name AS product_name,
            p.category
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ${order.id}
        `;
        return {
          ...order,
          items: Array.isArray(items) ? items : [],
        };
      })
    );

    return NextResponse.json({ orders: result }, { status: 200 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}