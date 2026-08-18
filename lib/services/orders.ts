import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { JWTPayload } from "@/lib/auth";
import { canCharge } from "@/lib/permissions";
import { assertOwnsTable } from "@/lib/tenant";
import { withTransaction, InsufficientStockError } from "@/lib/withTransaction";
import {
  AppError,
  ForbiddenActionError,
  InvalidDiscountError,
} from "@/lib/errors";
import { computeOrderTotals } from "@/lib/services/order-totals";

export const VALID_PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "otro"] as const;

export async function attachOrderItems(order: any) {
  const items = await sql`
    SELECT oi.*, p.name as product_name, p.category
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ${order.id}
  `;
  order.items = items.map((item: any) => ({
    ...item,
    product: { name: item.product_name, price: item.price, category: item.category },
  }));
  return order;
}

export async function transferOrderToTable(opts: {
  orderId: number;
  newTableId: number;
  user: JWTPayload;
  current: any;
}) {
  const { orderId, newTableId, user, current } = opts;
  if (current.status !== "open" && current.status !== "bill_requested") {
    throw new AppError(
      "Solo se pueden transferir órdenes abiertas o con cuenta pedida",
      400
    );
  }

  const targetGuard = await assertOwnsTable(newTableId, user);
  if (targetGuard.error) return { errorResponse: targetGuard.error };

  const targetTable = await sql`SELECT * FROM tables WHERE id = ${newTableId}`;
  if (targetTable.length === 0) {
    throw new AppError("Mesa destino no encontrada", 404);
  }

  const openOnTarget = await sql`
    SELECT id FROM orders
    WHERE table_id = ${newTableId}
      AND status IN ('open', 'bill_requested')
      AND id <> ${orderId}
    LIMIT 1
  `;
  if (openOnTarget[0]) {
    throw new AppError("La mesa destino ya tiene una orden abierta", 409);
  }

  const updated = await sql`
    UPDATE orders
    SET table_id = ${newTableId}, updated_at = NOW(), modified_by = ${user.id}
    WHERE id = ${orderId}
    RETURNING *
  `;
  if (!updated[0]) {
    throw new AppError("No se pudo transferir (la mesa destino ya tiene una orden abierta)", 409);
  }

  const loc = await sql`SELECT location_id FROM tables WHERE id = ${current.table_id}`;
  await logAudit({
    locationId: loc[0]?.location_id ?? null,
    userId: user.id,
    action: "transfer_order",
    entityType: "order",
    entityId: orderId,
    details: `mesa ${current.table_id} → ${newTableId}`,
  });

  const order = await attachOrderItems(updated[0]);
  return { order };
}

export async function closeOrderWithPayment(opts: {
  orderId: number;
  user: JWTPayload;
  status: string;
  paymentMethod: string;
  tipAmount: unknown;
  discountAmount: unknown;
  discountReason?: string;
  authorizerEmail?: string;
  authorizerPassword?: string;
  amountReceived?: unknown;
  locationId: number | null;
}) {
  const {
    orderId,
    user,
    status,
    paymentMethod,
    tipAmount,
    discountAmount,
    discountReason,
    authorizerEmail,
    authorizerPassword,
    amountReceived,
    locationId,
  } = opts;

  if (!canCharge(user.role)) {
    throw new ForbiddenActionError(
      user.role === "waiter"
        ? "El mesero no puede cobrar ni cerrar la cuenta. Llama a caja."
        : "Sin permiso para cobrar"
    );
  }

  const existing = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
  const current = existing[0];
  if (!current) throw new AppError("Order not found", 404);

  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod as any)) {
    throw new AppError(
      "Método de pago inválido. Usa: " + VALID_PAYMENT_METHODS.join(", "),
      400
    );
  }

  const tip = Number(tipAmount) || 0;
  let discount = Number(discountAmount) || 0;
  if (tip < 0 || discount < 0) {
    throw new AppError("Propina y descuento no pueden ser negativos", 400);
  }

  let discountAuthorizedBy: number | null = null;

  if (discount > 0) {
    if (user.role === "admin" || user.role === "owner") {
      discountAuthorizedBy = user.id;
    } else {
      if (!authorizerEmail || !authorizerPassword) {
        throw new ForbiddenActionError(
          "Para aplicar un descuento, un admin debe autorizar con su email y contraseña"
        );
      }
      const authRows = await sql`SELECT * FROM users WHERE email = ${authorizerEmail} LIMIT 1`;
      const authorizer = authRows[0];
      if (!authorizer || (authorizer.role !== "admin" && authorizer.role !== "owner")) {
        throw new ForbiddenActionError("Autorizador inválido");
      }
      const validPw = await bcrypt.compare(authorizerPassword, authorizer.password_hash);
      if (!validPw) {
        throw new ForbiddenActionError("Contraseña de autorización incorrecta");
      }
      discountAuthorizedBy = authorizer.id;
    }
    if (!discountReason || !String(discountReason).trim()) {
      throw new InvalidDiscountError("Debes indicar el motivo del descuento");
    }
  }

  // Subtotal from items
  const itemSums = await sql`
    SELECT COALESCE(SUM(quantity * price), 0) as subtotal
    FROM order_items WHERE order_id = ${orderId}
  `;
  const subtotal = Number(itemSums[0]?.subtotal) || Number(current.total_amount) || 0;

  let taxRate = 0;
  if (current.table_id) {
    const locRow = await sql`
      SELECT l.tax_rate FROM tables t
      JOIN locations l ON l.id = t.location_id
      WHERE t.id = ${current.table_id} LIMIT 1
    `;
    taxRate = Number(locRow[0]?.tax_rate) || 0;
  } else {
    // self-service / no table
    const p = await sql`
      SELECT l.tax_rate
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN locations l ON l.id = p.location_id
      WHERE oi.order_id = ${orderId}
      LIMIT 1
    `;
    taxRate = Number(p[0]?.tax_rate) || 0;
  }

  const { tax, finalTotal } = computeOrderTotals({
    subtotal,
    discount,
    tip,
    taxRate,
  });

  const lineItems = await sql`
    SELECT oi.product_id, oi.quantity, p.name, COALESCE(p.stock, 0) AS stock
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ${orderId}
  `;

  let updatedRow: any;
  try {
    updatedRow = await withTransaction(async (client) => {
      for (const item of lineItems) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0 || !item.product_id) continue;
        const result = await client.query(
          `UPDATE products
           SET stock = COALESCE(stock, 0) - $1, updated_at = NOW()
           WHERE id = $2 AND COALESCE(stock, 0) >= $1
           RETURNING id, stock`,
          [qty, item.product_id]
        );
        if (result.rowCount === 0) {
          throw new InsufficientStockError(
            `Sin stock suficiente de "${item.name}". Repón inventario antes de cobrar.`,
            item.name
          );
        }
        const reason = `Venta mesa (orden #${orderId})`;
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
           VALUES ($1, $2, 'sale', $3, $4)`,
          [item.product_id, qty, reason, user.id]
        );
      }

      const upd = await client.query(
        `UPDATE orders
         SET status = $1,
             closed_at = NOW(),
             updated_at = NOW(),
             modified_by = $2,
             payment_method = $3,
             tip_amount = $4,
             discount_amount = $5,
             discount_reason = $6,
             discount_authorized_by = $7,
             subtotal_amount = $8,
             tax_amount = $9,
             total_amount = $10
         WHERE id = $11
         RETURNING *`,
        [
          status,
          user.id,
          paymentMethod,
          tip,
          discount,
          discount > 0 ? discountReason : null,
          discountAuthorizedBy,
          subtotal,
          tax,
          finalTotal,
          orderId,
        ]
      );
      return upd.rows[0];
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) throw e;
    throw e;
  }

  const received = Number(amountReceived);
  const changeDue =
    Number.isFinite(received) && received > 0
      ? Math.max(0, received - finalTotal)
      : null;

  await logAudit({
    locationId,
    userId: user.id,
    action: "close_order",
    entityType: "order",
    entityId: orderId,
    details: `pago=${paymentMethod} propina=${tip} descuento=${discount}${
      discount > 0 ? ` (${discountReason}, autorizado por #${discountAuthorizedBy})` : ""
    } total=${finalTotal}${
      Number.isFinite(received) ? ` recibe=${received} vuelto=${changeDue}` : ""
    }`,
  });

  const order = await attachOrderItems(updatedRow);
  return {
    order,
    breakdown: { subtotal, discount, tax, taxRate, tip, total: finalTotal },
  };
}

export async function setOrderManualStatus(opts: {
  orderId: number;
  user: JWTPayload;
  status: string;
}) {
  const { orderId, user, status } = opts;
  const MANUAL_STATUSES = ["open", "bill_requested"];

  if (user.role === "waiter") {
    if (status !== "bill_requested" && status !== "open") {
      throw new ForbiddenActionError(
        "El mesero solo puede marcar 'Cuenta pedida' o dejar la orden abierta"
      );
    }
  } else if (!canCharge(user.role) && user.role !== "waiter") {
    throw new ForbiddenActionError("Sin permiso para cambiar estado");
  }

  if (
    !MANUAL_STATUSES.includes(status) &&
    status !== "closed" &&
    status !== "paid"
  ) {
    if (!["open", "bill_requested", "paid", "closed"].includes(status)) {
      throw new AppError("Estado inválido", 400);
    }
  }

  const orders = await sql`
    UPDATE orders
    SET status = ${status}, updated_at = NOW(), modified_by = ${user.id}
    WHERE id = ${orderId}
    RETURNING *
  `;
  if (!orders[0]) throw new AppError("Order not found", 404);
  return attachOrderItems(orders[0]);
}
