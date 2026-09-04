import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { assertOwnsCashSession } from "@/lib/tenant";
import { canManageCashSession } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !canManageCashSession(user.role)) {
      return NextResponse.json({ error: "Sin permiso para cerrar el turno de caja" }, { status: 403 });
    }

    const { id } = await params;
    const sessionId = parseInt(id);

    const guard = await assertOwnsCashSession(sessionId, user);
    if (guard.error) return guard.error;
    const sessions = await sql`SELECT * FROM cash_sessions WHERE id = ${sessionId}`;
    const session = sessions[0];
    if (!session) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    if (session.closed_at) return NextResponse.json({ error: "Este turno ya está cerrado" }, { status: 400 });

    const { closingAmount, notes } = await request.json();
    const counted = Number(closingAmount);
    if (isNaN(counted) || counted < 0) {
      return NextResponse.json({ error: "Monto contado inválido" }, { status: 400 });
    }

    // Efectivo esperado = monto inicial + ventas en efectivo del local durante el turno.
    // Incluye mesas (closed/paid) y autoservicio cobrado (PREPARING/READY/COMPLETED)
    // filtrado por location_id de la sesión de caja.
    const locId = session.location_id;
    const cashSalesRows = await sql`
      SELECT COALESCE(SUM(o.total_amount), 0) as total
      FROM orders o
      WHERE o.payment_method = 'efectivo'
        AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
        AND o.closed_at IS NOT NULL
        AND o.closed_at >= ${session.opened_at}
        AND o.closed_at <= NOW()
        AND (
          -- Pedidos de mesa del local
          EXISTS (
            SELECT 1 FROM tables t
            WHERE t.id = o.table_id AND t.location_id = ${locId}
          )
          OR
          -- Autoservicio: productos del local
          EXISTS (
            SELECT 1 FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = o.id AND p.location_id = ${locId}
          )
        )
    `;
    const cashSales = parseFloat(cashSalesRows[0]?.total || 0);
    const expected = parseFloat(session.opening_amount) + cashSales;
    const difference = counted - expected;

    const updated = await sql`
      UPDATE cash_sessions
      SET closed_by = ${user.id}, closing_amount = ${counted},
          expected_amount = ${expected}, difference = ${difference},
          closed_at = NOW(), notes = ${notes || null}
      WHERE id = ${sessionId}
      RETURNING *
    `;

    await logAudit({
      locationId: session.location_id,
      userId: user.id,
      action: "close_cash_session",
      entityType: "cash_session",
      entityId: sessionId,
      details: `contado=${counted} esperado=${expected} diferencia=${difference}`,
    });

    return NextResponse.json({ session: updated[0] }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
