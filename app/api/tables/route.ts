import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get first location
    const location = await prisma.location.findFirst();

    if (!location) {
      return NextResponse.json({ tables: [] }, { status: 200 });
    }

    const tables = await prisma.table.findMany({
      where: { locationId: location.id },
      orderBy: { number: "asc" },
    });

    return NextResponse.json({ tables }, { status: 200 });
  } catch (error) {
    console.error("Get tables error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { number, seats, x, y } = await request.json();

    if (number === undefined) {
      return NextResponse.json(
        { error: "Table number is required" },
        { status: 400 }
      );
    }

    // Get first location
    const location = await prisma.location.findFirst();

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const table = await prisma.table.create({
      data: {
        locationId: location.id,
        number,
        seats: seats || 4,
        x: x || 0,
        y: y || 0,
      },
    });

    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    console.error("Create table error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
