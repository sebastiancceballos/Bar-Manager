import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    try {
    } catch (_) { }

    const locations = await sql`SELECT id, name, address, COALESCE(active, true) as active FROM locations ORDER BY name ASC`;
    const locs = Array.isArray(locations) ? locations : [];

    const barsData = await Promise.all(locs.map(async (l) => {
      const [tables, occupied, admins, waiters, revToday, ordToday, revMonth] = await Promise.all([
        sql`SELECT COUNT(*) as c FROM tables WHERE location_id = ${l.id}`,
        sql`SELECT COUNT(DISTINCT o.table_id) as c FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.status = 'open' AND t.location_id = ${l.id}`,
        sql`SELECT COUNT(*) as c FROM users WHERE location_id = ${l.id} AND role = 'admin'`,
        sql`SELECT COUNT(*) as c FROM users WHERE location_id = ${l.id} AND role IN ('waiter', 'cashier', 'kitchen')`,
        // Revenue today: dine_in + self_service cobrados
        sql`
          SELECT COALESCE(SUM(o.total_amount),0) as s
          FROM orders o
          LEFT JOIN tables t ON o.table_id = t.id
          WHERE o.status IN ('closed','paid','PAID','PREPARING','READY','COMPLETED')
            AND DATE(o.created_at) = CURRENT_DATE
            AND (
              t.location_id = ${l.id}
              OR EXISTS (
                SELECT 1 FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = o.id AND p.location_id = ${l.id}
              )
            )
        `,
        sql`
          SELECT COUNT(*) as c
          FROM orders o
          LEFT JOIN tables t ON o.table_id = t.id
          WHERE DATE(o.created_at) = CURRENT_DATE
            AND (
              t.location_id = ${l.id}
              OR EXISTS (
                SELECT 1 FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = o.id AND p.location_id = ${l.id}
              )
            )
        `,
        sql`
          SELECT COALESCE(SUM(o.total_amount),0) as s
          FROM orders o
          LEFT JOIN tables t ON o.table_id = t.id
          WHERE o.status IN ('closed','paid','PAID','PREPARING','READY','COMPLETED')
            AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
            AND (
              t.location_id = ${l.id}
              OR EXISTS (
                SELECT 1 FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = o.id AND p.location_id = ${l.id}
              )
            )
        `,
      ]);
      return {
        id: l.id,
        name: l.name,
        address: l.address,
        active: l.active !== false,
        totalTables: parseInt(tables[0]?.c || 0),
        occupiedTables: parseInt(occupied[0]?.c || 0),
        adminCount: parseInt(admins[0]?.c || 0),
        waiterCount: parseInt(waiters[0]?.c || 0),
        revenueToday: parseFloat(revToday[0]?.s || 0),
        ordersToday: parseInt(ordToday[0]?.c || 0),
        revenueMonth: parseFloat(revMonth[0]?.s || 0),
      };
    }));

    const totalRevenueToday = barsData.reduce((s, b) => s + b.revenueToday, 0);
    const totalRevenueMonth = barsData.reduce((s, b) => s + b.revenueMonth, 0);
    const totalOrdersToday = barsData.reduce((s, b) => s + b.ordersToday, 0);
    const totalActiveBars = barsData.filter(b => b.active).length;

    return NextResponse.json({
      bars: barsData,
      totals: {
        totalBars: barsData.length,
        activeBars: totalActiveBars,
        revenueToday: totalRevenueToday,
        revenueMonth: totalRevenueMonth,
        ordersToday: totalOrdersToday,
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Owner stats error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
