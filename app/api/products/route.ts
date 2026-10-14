import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";
import { apiT } from "@/lib/api-i18n";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: apiT(request, "apiUnauthorized") }, { status: 401 });
    }

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) {
      return NextResponse.json({ error: apiT(request, "apiNoLocationAssigned") }, { status: 400 });
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
      return NextResponse.json({ error: apiT(request, "apiUnauthorized") }, { status: 403 });
    }

    const { name, category, price, imageUrl, available } = await request.json();

    if (!name || !category || price === undefined) {
      return NextResponse.json({ error: apiT(request, "apiMissingRequiredFields") }, { status: 400 });
    }

    const locationId = await resolveLocationId(user.id, user.role);
    if (!locationId) {
      return NextResponse.json(
        { error: apiT(request, "apiAdminNoLocation") },
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
