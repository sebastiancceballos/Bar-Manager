import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { name, category, price, imageUrl, available } = await request.json();

    const products = await sql`
      UPDATE products 
      SET 
        name = COALESCE(${name}, name),
        category = COALESCE(${category}, category),
        price = COALESCE(${price !== undefined ? parseFloat(price) : null}, price),
        image_url = COALESCE(${imageUrl !== undefined ? imageUrl : null}, image_url),
        available = COALESCE(${available !== undefined ? available : null}, available),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json({ product: products[0] }, { status: 200 });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;

    await sql`DELETE FROM products WHERE id = ${parseInt(id)}`;

    return NextResponse.json(
      { message: "Product deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
