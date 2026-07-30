import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getLocationTimezone } from "@/lib/location";

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

    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id;
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const tz = await getLocationTimezone(locId);

    const orders = await sql`
      SELECT
        o.id,
        o.total_amount,
        o.tip_amount,
        o.discount_amount,
        o.payment_method,
        o.status,
        o.created_at,
        o.closed_at,
        o.order_type,
        o.ticket_number,
        o.client_name,
        o.customer_notes,
        t.table_number,
        u.name AS waiter_name,
        COALESCE(
          l.name,
          (
            SELECT l2.name
            FROM order_items oi2
            JOIN products p2 ON oi2.product_id = p2.id
            JOIN locations l2 ON p2.location_id = l2.id
            WHERE oi2.order_id = o.id
            LIMIT 1
          )
        ) AS location_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN locations l ON t.location_id = l.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= ${from}::date
        AND DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) <= ${to}::date
        AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
        AND (
          t.location_id = ${locId}
          OR EXISTS (
            SELECT 1 FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = o.id AND p.location_id = ${locId}
          )
        )
      ORDER BY o.created_at ASC
    `;

    const result = await Promise.all(
      (Array.isArray(orders) ? orders : []).map(async (order) => {
        const items = await sql`
          SELECT
            oi.quantity,
            oi.price,
            oi.notes,
            p.name AS product_name,
            p.category
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ${order.id}
        `;
        return {
          ...order,
          table_number:
            order.order_type === "self_service"
              ? order.ticket_number || "Autoservicio"
              : order.table_number,
          waiter_name:
            order.order_type === "self_service"
              ? order.client_name
                ? `Cliente: ${order.client_name}`
                : "Autoservicio"
              : order.waiter_name,
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
