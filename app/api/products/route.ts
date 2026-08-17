import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const products = await sql`
      SELECT * FROM products
      WHERE location_id = ${locId}
      ORDER BY category ASC, name ASC
    `;

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

    const { name, category, price, imageUrl, available } = await request.json();

    if (!name || !category || price === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the authenticated user's location
    const locationId = await resolveLocationId(user.id, user.role);
    if (!locationId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
      return NextResponse.json(
        { error: "Admin does not have a location assigned" },
        { status: 400 }
      );
    }

    const products = await sql`
      INSERT INTO products (location_id, name, category, price, image_url, available)
      VALUES (${locationId}, ${name}, ${category}, ${parseFloat(price)}, ${imageUrl ?? null}, ${available !== undefined ? available : true})
      RETURNING *
    `;

    return NextResponse.json({ product: products[0] }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}