import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { assertOwnsProduct } from "@/lib/tenant";
import { withTransaction, InsufficientStockError } from "@/lib/withTransaction";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
    }

    const guard = await assertOwnsProduct(productId, user);
    if (guard.error) return guard.error;

    const body = await request.json();
    const { quantity, type, reason } = body;

    if (!quantity || !type) {
      return NextResponse.json({ error: "Cantidad y tipo son obligatorios" }, { status: 400 });
    }

    const qtyNum = parseInt(quantity, 10);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }

    const isEntry = type === "entry";

    try {
      await withTransaction(async (client) => {
        if (isEntry) {
          await client.query(
            `UPDATE products SET stock = COALESCE(stock, 0) + $1, updated_at = NOW() WHERE id = $2`,
            [qtyNum, productId]
          );
        } else {
          const result = await client.query(
            `UPDATE products
             SET stock = COALESCE(stock, 0) - $1, updated_at = NOW()
             WHERE id = $2 AND COALESCE(stock, 0) >= $1
             RETURNING id, stock, name`,
            [qtyNum, productId]
          );
          if (result.rowCount === 0) {
            throw new InsufficientStockError("Stock insuficiente para esta salida");
          }
        }
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, qtyNum, type, reason || null, user.id]
        );
      });
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json({ message: "Inventario actualizado correctamente" });
  } catch (error) {
    return toErrorResponse(error);
  }
}
