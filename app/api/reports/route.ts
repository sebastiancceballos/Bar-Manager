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

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "week";

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case "month":
        startDate.setDate(now.getDate() - 30);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case "week":
      default:
        startDate.setDate(now.getDate() - 7);
    }

    startDate.setHours(0, 0, 0, 0);

    // Get location
    const location = await prisma.location.findFirst();

    if (!location) {
      return NextResponse.json({ reports: [] }, { status: 200 });
    }

    // Get orders in range
    const orders = await prisma.order.findMany({
      where: {
        locationId: location.id,
        createdAt: {
          gte: startDate,
        },
        status: {
          in: ["closed", "paid"],
        },
      },
      include: { items: true },
    });

    // Group by date
    const reportMap = new Map<string, { total: number; count: number }>();

    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!reportMap.has(date)) {
        reportMap.set(date, { total: 0, count: 0 });
      }
      const current = reportMap.get(date)!;
      current.total += order.total;
      current.count += 1;
    });

    // Convert to array and sort
    const reports = Array.from(reportMap.entries())
      .map(([date, data]) => ({
        date,
        total: data.total,
        orderCount: data.count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ reports }, { status: 200 });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
