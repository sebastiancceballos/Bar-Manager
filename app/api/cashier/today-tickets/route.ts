import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { getLocationTimezone } from "@/lib/location";
import { sql } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";

/**
 * Historial de cobros de HOY para reimprimir tickets.
 * Solo rol cashier (el admin usa Reportes).
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.role !== "cashier") {
      return NextResponse.json(
        { error: "Solo el cajero puede usar este listado" },
        { status: 403 }
      );
    }

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    const tz = await getLocationTimezone(locId);

    const orders = await sql`
      SELECT
        o.id,
        o.table_id,
        o.total_amount,
        o.status,
        o.payment_method,
        o.tip_amount,
        o.discount_amount,
        o.subtotal_amount,
        o.tax_amount,
        o.created_at,
        o.closed_at,
        o.order_type,
        o.ticket_number,
        o.client_name,
        t.table_number,
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
      WHERE o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
        AND (
          (o.closed_at IS NOT NULL
            AND DATE(o.closed_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz})
              = (CURRENT_TIMESTAMP AT TIME ZONE ${tz})::date)
          OR (o.closed_at IS NULL
            AND DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz})
              = (CURRENT_TIMESTAMP AT TIME ZONE ${tz})::date)
        )
        AND (
          t.location_id = ${locId}
          OR EXISTS (
            SELECT 1 FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = o.id AND p.location_id = ${locId}
          )
        )
      ORDER BY COALESCE(o.closed_at, o.created_at) DESC
      LIMIT 100
    `;

    if (!orders.length) {
      return NextResponse.json({ orders: [] });
    }

    const ids = orders.map((o: any) => Number(o.id));
    const allItems = await sql`
      SELECT
        oi.order_id,
        oi.id,
        oi.quantity,
        oi.price,
        oi.notes,
        p.name AS product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ANY(${ids})
    `;

    const byOrder = new Map<number, any[]>();
    for (const item of allItems) {
      const oid = Number(item.order_id);
      const list = byOrder.get(oid) || [];
      list.push({
        id: item.id,
        product_name: item.product_name || "Producto",
        quantity: item.quantity,
        price: item.price,
        notes: item.notes,
      });
      byOrder.set(oid, list);
    }

    const result = orders.map((o: any) => ({
      id: o.id,
      table_number: o.table_number != null ? String(o.table_number) : null,
      ticket_number: o.ticket_number,
      order_type: o.order_type,
      client_name: o.client_name,
      total_amount: Number(o.total_amount) || 0,
      subtotal_amount: o.subtotal_amount != null ? Number(o.subtotal_amount) : null,
      tax_amount: o.tax_amount != null ? Number(o.tax_amount) : 0,
      tip_amount: o.tip_amount != null ? Number(o.tip_amount) : 0,
      discount_amount: o.discount_amount != null ? Number(o.discount_amount) : 0,
      payment_method: o.payment_method,
      status: o.status,
      created_at: o.created_at,
      closed_at: o.closed_at,
      location_name: o.location_name,
      items: byOrder.get(Number(o.id)) || [],
    }));

    return NextResponse.json({ orders: result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
