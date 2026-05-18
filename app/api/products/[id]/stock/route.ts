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
    const body = await request.json();
    const { quantity, type, reason } = body;

    if (!quantity || !type) {
      return NextResponse.json({ error: "Cantidad y tipo son obligatorios" }, { status: 400 });
    }

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
    }

    const qtyNum = parseInt(quantity);
    const multiplier = (type === 'entry') ? 1 : -1;
    const change = qtyNum * multiplier;

    if (multiplier === -1) {
      // Verificar stock actual antes de restar
      const productRows = await sql`SELECT stock, name FROM products WHERE id = ${productId}`;
      const product = productRows[0];
      
      if (!product) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      const currentStock = product.stock || 0;
      if (currentStock < qtyNum) {
        return NextResponse.json(
          { error: `Stock insuficiente. Solo tienes ${currentStock} unidades de ${product.name}.` },
          { status: 400 }
        );
      }
    }

    // 1. Update product stock
    await sql`
      UPDATE products 
      SET stock = COALESCE(stock, 0) + ${change}
      WHERE id = ${productId}
    `;

    // 2. Record movement
    await sql`
      INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
      VALUES (${productId}, ${qtyNum}, ${type}, ${reason || null}, ${user.id})
    `;

    return NextResponse.json({ message: "Inventario actualizado correctamente" });
  } catch (error) {
    console.error("Update stock error:", error);
    return NextResponse.json({ error: "Error al actualizar inventario (posiblemente falta ejecutar /api/setup-inventory)" }, { status: 500 });
  }
}
