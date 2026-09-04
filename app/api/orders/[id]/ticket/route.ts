import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsOrder } from "@/lib/tenant";
import { sql } from "@/lib/db";

const ALLOWED_ROLES = ["owner", "admin", "cashier", "kitchen", "waiter"];

/**
 * Datos del ticket 80mm de autoservicio.
 * Incluye local y cajero (quien cobró / último modificador, o quien imprime si es cajero).
 */
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
    const orderGuard = await assertOwnsOrder(orderId, user);
    if (orderGuard.error) return orderGuard.error;

    const rows = await sql`
      SELECT
        o.id,
        o.ticket_number,
        o.client_name,
        o.customer_notes,
        o.total_amount,
        o.created_at,
        o.updated_at,
        o.modified_by,
        o.status,
        loc.id AS location_id,
        loc.name AS location_name,
        loc.address AS location_address,
        cashier.name AS cashier_name
      FROM orders o
      LEFT JOIN users cashier ON o.modified_by = cashier.id
      LEFT JOIN LATERAL (
        SELECT l.id, l.name, l.address
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN locations l ON p.location_id = l.id
        WHERE oi.order_id = o.id
        LIMIT 1
      ) loc ON true
      WHERE o.id = ${orderId} AND o.order_type = 'self_service'
      LIMIT 1
    `;
    const order = rows[0];
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Cajero: 1) quien cobró (audit PENDING_PAYMENT -> PREPARING)
    //         2) modified_by actual
    //         3) quien imprime si es cajero/admin
    let cashierName = order.cashier_name as string | null;
    try {
      const charged = await sql`
        SELECT u.name
        FROM audit_log a
        JOIN users u ON a.user_id = u.id
        WHERE a.entity_type = 'order'
          AND a.entity_id = ${orderId}
          AND a.action = 'self_service_status_change'
          AND a.details ILIKE '%PENDING_PAYMENT%'
          AND a.details ILIKE '%PREPARING%'
        ORDER BY a.created_at ASC
        LIMIT 1
      `;
      if (charged[0]?.name) cashierName = charged[0].name;
    } catch {
      /* audit_log puede no existir en installs viejos */
    }
    if (!cashierName && (user.role === "cashier" || user.role === "admin")) {
      const me = await sql`SELECT name FROM users WHERE id = ${user.id} LIMIT 1`;
      cashierName = me[0]?.name || null;
    }

    // Fallback de local: bar asignado al usuario que imprime
    let locationName = order.location_name as string | null;
    let locationAddress = order.location_address as string | null;
    if (!locationName) {
      const loc = await sql`
        SELECT l.name, l.address
        FROM users u
        JOIN locations l ON u.location_id = l.id
        WHERE u.id = ${user.id}
        LIMIT 1
      `;
      locationName = loc[0]?.name || null;
      locationAddress = loc[0]?.address || null;
    }

    const items = await sql`
      SELECT oi.quantity, oi.notes, oi.price, p.name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${order.id}
    `;

    return NextResponse.json(
      {
        ticketNumber: order.ticket_number,
        clientName: order.client_name,
        customerNotes: order.customer_notes,
        total: order.total_amount,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        status: order.status,
        locationName,
        locationAddress,
        cashierName,
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
