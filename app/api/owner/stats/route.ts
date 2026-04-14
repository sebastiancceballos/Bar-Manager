import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    // All bars with their stats
    const bars = await sql`
      SELECT
        l.id,
        l.name,
        l.address,
        COALESCE(l.active, true) as active,
        COUNT(DISTINCT t.id) as total_tables,
        COUNT(DISTINCT CASE WHEN o.status = 'open' THEN o.table_id END) as occupied_tables,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') as admin_count,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'waiter') as waiter_count,
        COALESCE(SUM(CASE 
          WHEN o.status IN ('closed','paid') 
            AND o.created_at >= CURRENT_DATE 
            AND o.created_at < CURRENT_DATE + INTERVAL '1 day'
          THEN o.total_amount ELSE 0 END), 0) as revenue_today,
        COUNT(CASE 
          WHEN o.created_at >= CURRENT_DATE 
            AND o.created_at < CURRENT_DATE + INTERVAL '1 day'
          THEN 1 END) as orders_today,
        COALESCE(SUM(CASE 
          WHEN o.status IN ('closed','paid')
            AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
          THEN o.total_amount ELSE 0 END), 0) as revenue_month
      FROM locations l
      LEFT JOIN tables t ON t.location_id = l.id
      LEFT JOIN orders o ON o.table_id = t.id
      LEFT JOIN users u ON u.location_id = l.id
      GROUP BY l.id, l.name, l.address, l.active
      ORDER BY l.name ASC
    `;

    const barsData = Array.isArray(bars) ? bars : [];

    // Global totals
    const totalRevenueToday = barsData.reduce((s, b) => s + parseFloat(b.revenue_today || 0), 0);
    const totalRevenueMonth = barsData.reduce((s, b) => s + parseFloat(b.revenue_month || 0), 0);
    const totalOrdersToday = barsData.reduce((s, b) => s + parseInt(b.orders_today || 0), 0);
    const totalActiveBars = barsData.filter(b => b.active !== false).length;

    return NextResponse.json({
      bars: barsData.map(b => ({
        id: b.id,
        name: b.name,
        address: b.address,
        active: b.active !== false,
        totalTables: parseInt(b.total_tables || 0),
        occupiedTables: parseInt(b.occupied_tables || 0),
        adminCount: parseInt(b.admin_count || 0),
        waiterCount: parseInt(b.waiter_count || 0),
        revenueToday: parseFloat(b.revenue_today || 0),
        ordersToday: parseInt(b.orders_today || 0),
        revenueMonth: parseFloat(b.revenue_month || 0),
      })),
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