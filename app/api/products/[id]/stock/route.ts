import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { quantity, type, reason } = await request.json();

    if (!quantity || !type) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Begin transaction (using separate queries for simplicity with neon serverless)
    const multiplier = (type === 'entry') ? 1 : -1;
    const change = quantity * multiplier;

    // 1. Update product stock
    await sql`
      UPDATE products 
      SET stock = COALESCE(stock, 0) + ${change}
      WHERE id = ${parseInt(id)}
    `;

    // 2. Record movement
    await sql`
      INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
      VALUES (${parseInt(id)}, ${quantity}, ${type}, ${reason}, ${user.id})
    `;

    return NextResponse.json({ message: "Inventario actualizado correctamente" });
  } catch (error) {
    console.error("Update stock error:", error);
    return NextResponse.json({ error: "Error al actualizar inventario" }, { status: 500 });
  }
}
