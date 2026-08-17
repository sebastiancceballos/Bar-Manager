import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";
import { getLocationTimezone } from "@/lib/location";

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

    let locId: number | null = null;
    if (currentUser.role === "admin") {
      locId = await resolveLocationId(currentUser.id, currentUser.role);
      if (!locId) return NextResponse.json({ error: "Admin sin bar asignado" }, { status: 400 });
    }

    const tz = locId ? await getLocationTimezone(locId) : "America/Bogota";

    // Incluye dine_in (mesa) y self_service (sin mesa, ubicación vía productos)
    const result = locId
      ? await sql`
          SELECT
            o.id, o.table_id, o.waiter_id, o.total_amount, o.status,
            o.payment_method, o.tip_amount, o.discount_amount, o.subtotal_amount, o.tax_amount,
            o.created_at, o.updated_at, o.modified_by,
            o.order_type, o.ticket_number, o.client_name, o.customer_notes, o.public_token,
            u.name AS waiter_name, u.email AS waiter_email,
            m.name AS modifier_name, m.email AS modifier_email,
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
          LEFT JOIN users u ON o.waiter_id = u.id
          LEFT JOIN users m ON o.modified_by = m.id
          LEFT JOIN tables t ON o.table_id = t.id
          LEFT JOIN locations l ON t.location_id = l.id
          WHERE DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) = ${date}::date
            AND (
              t.location_id = ${locId}
              OR EXISTS (
                SELECT 1 FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = o.id AND p.location_id = ${locId}
              )
            )
          ORDER BY o.created_at DESC
        `
      : await sql`
          SELECT
            o.id, o.table_id, o.waiter_id, o.total_amount, o.status,
            o.payment_method, o.tip_amount, o.discount_amount, o.subtotal_amount, o.tax_amount,
            o.created_at, o.updated_at, o.modified_by,
            o.order_type, o.ticket_number, o.client_name, o.customer_notes, o.public_token,
            u.name AS waiter_name, u.email AS waiter_email,
            m.name AS modifier_name, m.email AS modifier_email,
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
          LEFT JOIN users u ON o.waiter_id = u.id
          LEFT JOIN users m ON o.modified_by = m.id
          LEFT JOIN tables t ON o.table_id = t.id
          LEFT JOIN locations l ON t.location_id = l.id
          WHERE DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) = ${date}::date
          ORDER BY o.created_at DESC
        `;

    const orders = Array.isArray(result) ? result : [];

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const itemsResult = await sql`
          SELECT 
            oi.id,
            oi.product_id,
            oi.quantity,
            oi.price,
            oi.notes,
            p.name AS product_name
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ${order.id}
        `;

        return {
          ...order,
          // UI amigable: mesa / mesero para autoservicio
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
          items: Array.isArray(itemsResult) ? itemsResult : [],
        };
      })
    );

    return NextResponse.json({ orders: ordersWithItems }, { status: 200 });
  } catch (error) {
    console.error("Error fetching daily orders:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
