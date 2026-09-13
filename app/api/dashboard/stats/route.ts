import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";
import { locationRevenueToday } from "@/lib/services/revenue";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    const today = await locationRevenueToday(locId);

    const occupiedResult = await sql`
      SELECT COUNT(DISTINCT o.table_id)::int AS count
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE o.status IN ('open', 'bill_requested')
        AND t.location_id = ${locId}
    `;
    const tablesOccupied = Number(occupiedResult[0]?.count || 0);

    const tablesResult = await sql`
      SELECT COUNT(*)::int AS count FROM tables WHERE location_id = ${locId}
    `;
    const totalTables = Number(tablesResult[0]?.count || 0);

    return NextResponse.json({
      totalRevenue: today.revenue,
      /** Pedidos cobrados hoy (misma regla que totalRevenue) */
      ordersToday: today.orderCount,
      tablesOccupied,
      totalTables,
      timezone: today.timezone,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
