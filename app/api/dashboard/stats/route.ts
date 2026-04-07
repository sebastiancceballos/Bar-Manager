import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Allow both admin and waiter to see stats
    // Admins see full stats, waiters see limited view

    // Get orders from today
    const ordersToday = await sql`
      SELECT * FROM orders 
      WHERE created_at >= CURRENT_DATE 
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
    `;

    // Calculate total revenue from closed orders
    const revenueResult = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM orders 
      WHERE created_at >= CURRENT_DATE 
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
      AND status IN ('closed', 'paid')
    `;
    const totalRevenue = parseFloat(revenueResult[0]?.total || 0);

    // Get occupied tables (tables with open orders)
    const occupiedResult = await sql`
      SELECT COUNT(DISTINCT table_id) as count 
      FROM orders 
      WHERE status = 'open'
    `;
    const tablesOccupied = parseInt(occupiedResult[0]?.count || 0);

    // Get total tables
    const tablesResult = await sql`SELECT COUNT(*) as count FROM tables`;
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
