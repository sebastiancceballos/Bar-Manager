import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { sql } from "@/lib/db";
import { assertOwnsProduct } from "@/lib/tenant";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    const guard = await assertOwnsProduct(productId, user);
    if (guard.error) return guard.error;

    const { name, category, price, imageUrl, available } = await request.json();

    const products = await sql`
      UPDATE products 
      SET 
        name = COALESCE(${name}, name),
        category = COALESCE(${category}, category),
        price = COALESCE(${price !== undefined ? parseFloat(price) : null}, price),
        image_url = COALESCE(${imageUrl}, image_url),
        available = COALESCE(${available}, available),
        updated_at = NOW()
      WHERE id = ${productId}
      RETURNING *
    `;

    if (!products[0]) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ product: products[0] }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    const guard = await assertOwnsProduct(productId, user);
    if (guard.error) return guard.error;

    await sql`DELETE FROM products WHERE id = ${productId}`;

    return NextResponse.json({ message: "Product deleted" }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
