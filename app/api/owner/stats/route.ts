import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  locationRevenueToday,
  locationRevenueMonth,
} from "@/lib/services/revenue";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const locations = await sql`
      SELECT id, name, address, COALESCE(active, true) AS active
      FROM locations
      ORDER BY name ASC
    `;
    const locs = Array.isArray(locations) ? locations : [];

    const barsData = await Promise.all(
      locs.map(async (l: any) => {
        const locId = Number(l.id);
        const [tables, occupied, admins, waiters, today, revMonth] =
          await Promise.all([
            sql`SELECT COUNT(*)::int AS c FROM tables WHERE location_id = ${locId}`,
            sql`
              SELECT COUNT(DISTINCT o.table_id)::int AS c
              FROM orders o
              JOIN tables t ON o.table_id = t.id
              WHERE o.status IN ('open', 'bill_requested')
                AND t.location_id = ${locId}
            `,
            sql`
              SELECT COUNT(*)::int AS c FROM users
              WHERE location_id = ${locId} AND role = 'admin'
            `,
            sql`
              SELECT COUNT(*)::int AS c FROM users
              WHERE location_id = ${locId}
                AND role IN ('waiter', 'cashier', 'kitchen')
            `,
            locationRevenueToday(locId),
            locationRevenueMonth(locId),
          ]);

        return {
          id: locId,
          name: l.name,
          address: l.address,
          active: Boolean(l.active),
          totalTables: Number(tables[0]?.c || 0),
          occupiedTables: Number(occupied[0]?.c || 0),
          adminCount: Number(admins[0]?.c || 0),
          waiterCount: Number(waiters[0]?.c || 0),
          revenueToday: today.revenue,
          /** Solo pedidos cobrados hoy (misma regla que ingresos) */
          ordersToday: today.orderCount,
          revenueMonth: revMonth,
          timezone: today.timezone,
        };
      })
    );

    const totalRevenueToday = barsData.reduce((s, b) => s + b.revenueToday, 0);
    const totalRevenueMonth = barsData.reduce((s, b) => s + b.revenueMonth, 0);
    const totalOrdersToday = barsData.reduce((s, b) => s + b.ordersToday, 0);
    const totalActiveBars = barsData.filter((b) => b.active).length;

    return NextResponse.json({
      bars: barsData,
      totals: {
        totalBars: barsData.length,
        activeBars: totalActiveBars,
        revenueToday: totalRevenueToday,
        revenueMonth: totalRevenueMonth,
        ordersToday: totalOrdersToday,
        /** Aclara en UI que el total es suma de todos los locales */
        scope: "all_locations",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
