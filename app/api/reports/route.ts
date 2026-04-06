import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "week";

    // Calculate interval based on range
    let interval = "7 days";
    switch (range) {
      case "month":
        interval = "30 days";
        break;
      case "year":
        interval = "365 days";
        break;
      case "week":
      default:
        interval = "7 days";
    }

    // Get orders grouped by date
    const reports = await sql`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as total,
        COUNT(*) as order_count
      FROM orders
      WHERE created_at >= CURRENT_DATE - ${interval}::interval
      AND status IN ('closed', 'paid')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return NextResponse.json({ 
      reports: reports.map(r => ({
        date: r.date,
        total: parseFloat(r.total),
        orderCount: parseInt(r.order_count)
      }))
    }, { status: 200 });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
