import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { assertOwnsOrder } from "@/lib/tenant";
import { canCharge } from "@/lib/permissions";
import { computeSplit, houseRemainder } from "@/lib/order-split";
import { computeOrderTotals } from "@/lib/services/order-totals";
import { ConflictError, ForbiddenActionError, toErrorResponse } from "@/lib/errors";

/** GET: listar splits de la orden */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const orderId = parseInt(id, 10);
    const guard = await assertOwnsOrder(orderId, user);
    if (guard.error) return guard.error;

    const splits = await sql`
      SELECT * FROM order_splits
      WHERE order_id = ${orderId}
      ORDER BY split_index ASC
    `;
    const orderRows = await sql`SELECT total_amount, status FROM orders WHERE id = ${orderId}`;
    const total = Math.floor(Number(orderRows[0]?.total_amount) || 0);
    const paidSum = splits
      .filter((s: any) => Boolean(s.paid))
      .reduce((a: number, s: { amount: number }) => a + Math.floor(Number(s.amount)), 0);
    const house =
      splits.length > 0 ? houseRemainder(total, splits.length) : 0;

    return NextResponse.json({
      splits,
      total,
      houseRemainder: house,
      allPaid: splits.length > 0 && splits.every((s: any) => Boolean(s.paid)),
      paidSum,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST { parts: number } | { cancel: true }
 * Crea N partes o cancela splits no pagados.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canCharge(user.role)) {
      throw new ForbiddenActionError("Solo caja/admin puede dividir la cuenta");
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);
    const guard = await assertOwnsOrder(orderId, user);
    if (guard.error) return guard.error;

    const body = await request.json();

    if (body.cancel === true) {
      const unpaid = await sql`
        SELECT COUNT(*)::int AS c FROM order_splits
        WHERE order_id = ${orderId} AND paid = true
      `;
      if ((unpaid[0]?.c || 0) > 0) {
        throw new ConflictError(
          "Hay partes ya pagadas. No se pueden cancelar los splits automáticamente."
        );
      }
      await sql`DELETE FROM order_splits WHERE order_id = ${orderId}`;
      return NextResponse.json({ message: "Splits cancelados", splits: [] });
    }

    const parts = parseInt(String(body.parts), 10);
    if (!Number.isInteger(parts) || parts < 2 || parts > 20) {
      return NextResponse.json(
        { error: "parts debe ser un entero entre 2 y 20" },
        { status: 400 }
      );
    }

    const existing = await sql`
      SELECT id, paid FROM order_splits WHERE order_id = ${orderId}
    `;
    if (existing.length > 0) {
      throw new ConflictError(
        "La orden ya tiene splits. Cancélalos primero (POST { cancel: true }) si ninguno está pagado."
      );
    }

    const orderRows = await sql`
      SELECT id, status, total_amount FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    const order = orderRows[0];
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (["paid", "closed", "CANCELLED"].includes(order.status)) {
      return NextResponse.json(
        { error: "No se puede dividir una orden ya cerrada o cancelada" },
        { status: 400 }
      );
    }

    // Total real: subtotal ítems − descuento + IVA + propina (misma regla que cobro)
    const itemSums = await sql`
      SELECT COALESCE(SUM(quantity * price), 0) as subtotal
      FROM order_items WHERE order_id = ${orderId}
    `;
    const subtotal = Number(itemSums[0]?.subtotal) || Number(order.total_amount) || 0;
    let taxRate = 0;
    if (order.table_id) {
      const tr = await sql`
        SELECT l.tax_rate FROM tables t
        JOIN locations l ON l.id = t.location_id
        WHERE t.id = ${order.table_id} LIMIT 1
      `;
      taxRate = Number(tr[0]?.tax_rate) || 0;
    } else {
      const tr = await sql`
        SELECT l.tax_rate
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN locations l ON l.id = p.location_id
        WHERE oi.order_id = ${orderId}
        LIMIT 1
      `;
      taxRate = Number(tr[0]?.tax_rate) || 0;
    }
    const tip = Number(order.tip_amount) || 0;
    const discount = Number(order.discount_amount) || 0;
    const { finalTotal } = computeOrderTotals({
      subtotal,
      discount,
      tip,
      taxRate,
    });
    const total = Math.floor(finalTotal);
    if (total <= 0) {
      return NextResponse.json({ error: "El total de la orden es 0" }, { status: 400 });
    }

    const amounts = computeSplit(total, parts);
    const house = houseRemainder(total, parts);

    for (let i = 0; i < amounts.length; i++) {
      await sql`
        INSERT INTO order_splits (order_id, split_index, amount, paid)
        VALUES (${orderId}, ${i + 1}, ${amounts[i]}, false)
      `;
    }

    const splits = await sql`
      SELECT * FROM order_splits WHERE order_id = ${orderId} ORDER BY split_index
    `;

    return NextResponse.json(
      {
        splits,
        total,
        houseRemainder: house,
        message: `Cuenta dividida en ${parts} partes de ${amounts[0]} (residuo casa: ${house})`,
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
