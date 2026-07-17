import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getLocationTimezone } from "@/lib/location";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's location
    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id;
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const tz = await getLocationTimezone(locId);

    // Get orders from today (en la hora local del bar, no UTC) for this location
    const ordersToday = await sql`
      SELECT o.* FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= date_trunc('day', NOW() AT TIME ZONE ${tz})
        AND (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) < date_trunc('day', NOW() AT TIME ZONE ${tz}) + INTERVAL '1 day'
        AND t.location_id = ${locId}
    `;

    // Calculate total revenue from closed orders for this location
    const revenueResult = await sql`
      SELECT COALESCE(SUM(o.total_amount), 0) as total
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= date_trunc('day', NOW() AT TIME ZONE ${tz})
        AND (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) < date_trunc('day', NOW() AT TIME ZONE ${tz}) + INTERVAL '1 day'
        AND o.status IN ('closed', 'paid')
        AND t.location_id = ${locId}
    `;
    const totalRevenue = parseFloat(revenueResult[0]?.total || 0);

    // Get occupied tables for this location
    const occupiedResult = await sql`
      SELECT COUNT(DISTINCT o.table_id) as count
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE o.status = 'open' AND t.location_id = ${locId}
    `;
    const tablesOccupied = parseInt(occupiedResult[0]?.count || 0);

    // Get total tables for this location
    const tablesResult = await sql`SELECT COUNT(*) as count FROM tables WHERE location_id = ${locId}`;
    const totalTables = parseInt(tablesResult[0]?.count || 0);

    return NextResponse.json(
      {
        totalRevenue,
        ordersToday: ordersToday.length,
        tablesOccupied,
        totalTables,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}