import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    // Ensure active column exists
    try {
      await sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`;
    } catch (_) { }

    // Get all bars
    const locations = await sql`SELECT id, name, address, COALESCE(active, true) as active FROM locations ORDER BY name ASC`;
    const locs = Array.isArray(locations) ? locations : [];

    // Get stats per bar
    const barsData = await Promise.all(locs.map(async (l) => {
      const [tables, occupied, admins, waiters, revToday, ordToday, revMonth] = await Promise.all([
        sql`SELECT COUNT(*) as c FROM tables WHERE location_id = ${l.id}`,
        sql`SELECT COUNT(DISTINCT o.table_id) as c FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.status = 'open' AND t.location_id = ${l.id}`,
        sql`SELECT COUNT(*) as c FROM users WHERE location_id = ${l.id} AND role = 'admin'`,
        sql`SELECT COUNT(*) as c FROM users WHERE location_id = ${l.id} AND role = 'waiter'`,
        sql`SELECT COALESCE(SUM(o.total_amount),0) as s FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.status IN ('closed','paid') AND DATE(o.created_at) = CURRENT_DATE AND t.location_id = ${l.id}`,
        sql`SELECT COUNT(*) as c FROM orders o JOIN tables t ON o.table_id = t.id WHERE DATE(o.created_at) = CURRENT_DATE AND t.location_id = ${l.id}`,
        sql`SELECT COALESCE(SUM(o.total_amount),0) as s FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.status IN ('closed','paid') AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE) AND t.location_id = ${l.id}`,
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

    const bars = barsData;

    const barsData = Array.isArray(bars) ? bars : [];

    // Global totals
    const totalRevenueToday = barsData.reduce((s, b) => s + parseFloat(b.revenue_today || 0), 0);
    const totalRevenueMonth = barsData.reduce((s, b) => s + parseFloat(b.revenue_month || 0), 0);
    const totalOrdersToday = barsData.reduce((s, b) => s + parseInt(b.orders_today || 0), 0);
    const totalActiveBars = barsData.filter(b => b.active !== false).length;

    return NextResponse.json({
      bars: bars,
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