import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");

    // Get first location
    const location = await prisma.location.findFirst();

    if (!location) {
      return NextResponse.json({ orders: [] }, { status: 200 });
    }

    const where: any = {
      NOT: {
        status: "closed",
      },
    };

    // Filter by table if provided
    if (tableId) {
      where.table_id = parseInt(tableId);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
      },
    });

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await request.json();

    if (!tableId) {
      return NextResponse.json(
        { error: "Table ID is required" },
        { status: 400 }
      );
    }

    // Get location
    const location = await prisma.location.findFirst();

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Check if table already has open order
    const existingOrder = await prisma.order.findFirst({
      where: {
        table_id: parseInt(tableId),
        status: "open",
      },
    });

    if (existingOrder) {
      return NextResponse.json({ order: existingOrder }, { status: 200 });
    }

    // Get current user
    const userId = user.id;

    const order = await prisma.order.create({
      data: {
        table_id: parseInt(tableId),
        waiter_id: userId,
        status: "open",
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
