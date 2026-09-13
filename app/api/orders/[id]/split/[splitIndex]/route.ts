import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { assertOwnsOrder } from "@/lib/tenant";
import { canCharge } from "@/lib/permissions";
import { withTransaction, InsufficientStockError } from "@/lib/withTransaction";
import { ConflictError, ForbiddenActionError, toErrorResponse } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

const VALID_PAYMENT = ["efectivo", "tarjeta", "transferencia", "otro"];

/**
 * PATCH: marcar una parte como pagada.
 * Cuando todas están paid → cierra la orden y descuenta stock (transacción).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; splitIndex: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canCharge(user.role)) {
      throw new ForbiddenActionError("Solo caja/admin puede cobrar una parte");
    }

    const { id, splitIndex: splitIndexRaw } = await params;
    const orderId = parseInt(id, 10);
    const splitIndex = parseInt(splitIndexRaw, 10);
    const guard = await assertOwnsOrder(orderId, user);
    if (guard.error) return guard.error;

    const body = await request.json().catch(() => ({}));
    const paymentMethod = body.paymentMethod || "efectivo";
    if (!VALID_PAYMENT.includes(paymentMethod)) {
      return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
    }

    const splitRows = await sql`
      SELECT * FROM order_splits
      WHERE order_id = ${orderId} AND split_index = ${splitIndex}
      LIMIT 1
    `;
    const split = splitRows[0];
    if (!split) {
      return NextResponse.json({ error: "Parte no encontrada" }, { status: 404 });
    }
    if (split.paid) {
      throw new ConflictError("Esta parte ya está pagada");
    }

    await sql`
      UPDATE order_splits
      SET paid = true, paid_at = NOW(), payment_method = ${paymentMethod}
      WHERE id = ${split.id}
    `;

    const all = await sql`
      SELECT * FROM order_splits WHERE order_id = ${orderId} ORDER BY split_index
    `;
    const allPaid = all.every((s: any) => Boolean(s.paid));

    let orderClosed = false;
    if (allPaid) {
      try {
        await withTransaction(async (client) => {
          const orderRes = await client.query(
            `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
            [orderId]
          );
          const order = orderRes.rows[0];
          if (!order || ["paid", "closed"].includes(order.status)) {
            return;
          }

          const items = await client.query(
            `SELECT oi.product_id, oi.quantity, p.name
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = $1 AND oi.product_id IS NOT NULL`,
            [orderId]
          );

          for (const item of items.rows) {
            const qty = Number(item.quantity) || 0;
            if (qty <= 0) continue;
            const result = await client.query(
              `UPDATE products
               SET stock = COALESCE(stock, 0) - $1, updated_at = NOW()
               WHERE id = $2 AND COALESCE(stock, 0) >= $1
               RETURNING id`,
              [qty, item.product_id]
            );
            if (result.rowCount === 0) {
              throw new InsufficientStockError(
                `Sin stock suficiente de "${item.name}" al cerrar la cuenta dividida`
              );
            }
            await client.query(
              `INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
               VALUES ($1, $2, 'sale', $3, $4)`,
              [item.product_id, qty, `Venta dividida (orden #${orderId})`, user.id]
            );
          }

          await client.query(
            `UPDATE orders
             SET status = 'paid', closed_at = NOW(), updated_at = NOW(),
                 modified_by = $1, payment_method = $2
             WHERE id = $3`,
            [user.id, paymentMethod, orderId]
          );
          orderClosed = true;
        });
      } catch (e) {
        if (e instanceof InsufficientStockError) {
          // Revertir el paid de esta parte para no dejar estado inconsistente
          await sql`
            UPDATE order_splits SET paid = false, paid_at = null, payment_method = null
            WHERE id = ${split.id}
          `;
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
        throw e;
      }

      if (orderClosed && guard.locationId) {
        await logAudit({
          locationId: guard.locationId,
          userId: user.id,
          action: "close_order_split",
          entityType: "order",
          entityId: orderId,
          details: `Cuenta dividida cerrada; última parte #${splitIndex} pago=${paymentMethod}`,
        });
      }
    }

    const splits = await sql`
      SELECT * FROM order_splits WHERE order_id = ${orderId} ORDER BY split_index
    `;

    return NextResponse.json({
      split: splits.find((s: any) => s.split_index === splitIndex),
      splits,
      orderClosed: allPaid && orderClosed,
      allPaid,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
