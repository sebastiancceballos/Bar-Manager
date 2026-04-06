import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get default location (for now)
    const location = await prisma.location.findFirst();

    if (!location) {
      return NextResponse.json(
        {
          totalRevenue: 0,
          ordersToday: 0,
          tablesOccupied: 0,
          totalTables: 0,
        },
        { status: 200 }
      );
    }

    // Get orders from today
    const ordersToday = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: { items: true },
    });

    const totalRevenue = ordersToday
      .filter((o) => o.status === "paid" || o.status === "closed")
      .reduce((sum, order) => sum + order.total_amount, 0);

    // Get occupied tables
    const openOrders = await prisma.order.findMany({
      where: {
        status: "open",
      },
    });

    const occupiedTableIds = new Set(openOrders.map((o) => o.table_id));
    const tablesOccupied = occupiedTableIds.size;

    // Get total tables
    const totalTables = await prisma.table.count();

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
