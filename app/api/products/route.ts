import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";

export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    const products = await sql`
      SELECT * FROM products
      WHERE location_id = ${locId}
      ORDER BY category ASC, name ASC
    `;

    return NextResponse.json({ products }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, category, price, imageUrl, available } = await request.json();

    if (!name || !category || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const locationId = await resolveLocationId(user.id, user.role);
    if (!locationId) {
      return NextResponse.json(
        { error: "Admin does not have a location assigned" },
        { status: 400 }
      );
    }

    const products = await sql`
      INSERT INTO products (location_id, name, category, price, image_url, available)
      VALUES (
        ${locationId},
        ${name},
        ${category},
        ${parseFloat(price)},
        ${imageUrl ?? null},
        ${available !== undefined ? available : true}
      )
      RETURNING *
    `;

    return NextResponse.json({ product: products[0] }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
