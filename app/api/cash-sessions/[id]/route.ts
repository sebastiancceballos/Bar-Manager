import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Solo un admin puede cerrar el turno de caja" }, { status: 403 });
    }

    const { id } = await params;
    const sessionId = parseInt(id);

    const sessions = await sql`SELECT * FROM cash_sessions WHERE id = ${sessionId}`;
    const session = sessions[0];
    if (!session) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    if (session.closed_at) return NextResponse.json({ error: "Este turno ya está cerrado" }, { status: 400 });

    const { closingAmount, notes } = await request.json();
    const counted = Number(closingAmount);
    if (isNaN(counted) || counted < 0) {
      return NextResponse.json({ error: "Monto contado inválido" }, { status: 400 });
    }

    // Efectivo esperado = monto inicial + ventas en efectivo cobradas durante el turno
    const cashSalesRows = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM orders
      WHERE payment_method = 'efectivo'
        AND status IN ('closed', 'paid')
        AND closed_at >= ${session.opened_at}
        AND closed_at <= NOW()
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
    console.error("Cash session close error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
