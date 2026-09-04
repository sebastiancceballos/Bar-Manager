import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { resolveLocationId } from "@/lib/org";
import { canManageCashSession } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const open = await sql`
      SELECT cs.*, u.name as opened_by_name
      FROM cash_sessions cs
      LEFT JOIN users u ON cs.opened_by = u.id
      WHERE cs.location_id = ${locId} AND cs.closed_at IS NULL
      LIMIT 1
    `;

    const history = await sql`
      SELECT cs.*, u.name as opened_by_name, c.name as closed_by_name
      FROM cash_sessions cs
      LEFT JOIN users u ON cs.opened_by = u.id
      LEFT JOIN users c ON cs.closed_by = c.id
      WHERE cs.location_id = ${locId} AND cs.closed_at IS NOT NULL
      ORDER BY cs.closed_at DESC
      LIMIT 20
    `;

    return NextResponse.json({ open: open[0] || null, history }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !canManageCashSession(user.role)) {
      return NextResponse.json({ error: "Sin permiso para abrir el turno de caja" }, { status: 403 });
    }

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const { openingAmount } = await request.json();
    const amount = Number(openingAmount) || 0;
    if (amount < 0) return NextResponse.json({ error: "El monto inicial no puede ser negativo" }, { status: 400 });

    let created;
    try {
      created = await sql`
        INSERT INTO cash_sessions (location_id, opened_by, opening_amount)
        VALUES (${locId}, ${user.id}, ${amount})
        RETURNING *
      `;
    } catch {
      return NextResponse.json({ error: "Ya hay un turno de caja abierto para este bar" }, { status: 409 });
    }

    await logAudit({
      locationId: locId,
      userId: user.id,
      action: "open_cash_session",
      entityType: "cash_session",
      entityId: created[0].id,
      details: `monto_inicial=${amount}`,
    });

    return NextResponse.json({ session: created[0] }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
