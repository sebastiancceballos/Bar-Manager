import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get first location (for now, single location)
    const location = await prisma.location.findFirst();

    if (!location) {
      return NextResponse.json({ products: [] }, { status: 200 });
    }

    const products = await prisma.product.findMany({
      where: { location_id: location.id },
      orderBy: { category: "asc" },
    });

    return NextResponse.json({ products }, { status: 200 });
  } catch (error) {
    console.error("Get products error:", error);
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

    const { name, category, price } = await request.json();

    if (!name || !category || price === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    const product = await prisma.product.create({
      data: {
        location_id: location.id,
        name,
        category,
        price: parseFloat(price),
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
