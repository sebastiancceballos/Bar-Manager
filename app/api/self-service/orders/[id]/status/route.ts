import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canTransition, SELF_SERVICE_STATUSES, SelfServiceStatus } from "@/lib/self-service";

const ALLOWED_ROLES = ["owner", "admin", "cashier", "kitchen"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    const { status: newStatus } = await request.json();

    if (!SELF_SERVICE_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, status, order_type, ticket_number FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    const order = rows[0];
    if (!order || order.order_type !== "self_service") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (!canTransition(order.status, newStatus as SelfServiceStatus, user.role)) {
      return NextResponse.json(
        { error: `Tu rol (${user.role}) no puede pasar el pedido de ${order.status} a ${newStatus}` },
        { status: 403 }
      );
    }

    const updated = await sql`
      UPDATE orders SET status = ${newStatus}, updated_at = NOW(), modified_by = ${user.id}
      WHERE id = ${orderId}
      RETURNING id, ticket_number, status, updated_at
    `;

    await logAudit({
      userId: user.id,
      action: "self_service_status_change",
      entityType: "order",
      entityId: orderId,
      details: `Ficho ${order.ticket_number}: ${order.status} -> ${newStatus}`,
    });

    return NextResponse.json({ order: updated[0] }, { status: 200 });
  } catch (error) {
    console.error("Update self-service status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
