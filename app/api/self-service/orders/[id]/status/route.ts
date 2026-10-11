import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsOrder } from "@/lib/tenant";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canTransition, SELF_SERVICE_STATUSES, SelfServiceStatus } from "@/lib/self-service";
import { canCharge, canUseComandas } from "@/lib/permissions";
import { notifyOrder } from "@/lib/push";
import { apiT } from "@/lib/api-i18n";
import { withTransaction } from "@/lib/withTransaction";
import { ConflictError, toErrorResponse } from "@/lib/errors";
import { deductOrderStock, type DbClient } from "@/lib/services/stock";


const STOCK_DEDUCTED_STATUSES = new Set(["PAID", "PREPARING", "READY", "COMPLETED"]);

async function restoreStockForOrder(
  client: DbClient,
  orderId: number,
  ticketNumber: string | null,
  userId: number
): Promise<void> {
  const items = (
    await client.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL`,
      [orderId]
    )
  ).rows;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    await client.query(
      `UPDATE products SET stock = COALESCE(stock, 0) + $1, updated_at = NOW() WHERE id = $2`,
      [qty, item.product_id]
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
       VALUES ($1, $2, 'entry', $3, $4)`,
      [item.product_id, qty, `Cancelación autoservicio (ficho ${ticketNumber || "#" + orderId})`, userId]
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: apiT(request, "apiNotAuthenticated") }, { status: 401 });
    }
    // Cualquiera que opere comandas o cobre puede intentar la transición;
    // canTransition valida el movimiento concreto.
    if (!canUseComandas(user.role) && !canCharge(user.role)) {
      return NextResponse.json({ error: apiT(request, "apiNoPermission") }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    const ssGuard = await assertOwnsOrder(orderId, user);
    if (ssGuard.error) return ssGuard.error;

    const body = await request.json();
    const newStatus = body.status;
    const paymentMethodRaw = body.paymentMethod as string | undefined;
    const VALID_PAYMENT = ["efectivo", "tarjeta", "transferencia", "otro"];

    if (!SELF_SERVICE_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: apiT(request, "apiInvalidStatus") }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, status, order_type, ticket_number, public_token
      FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    const order = rows[0];
    if (!order || order.order_type !== "self_service") {
      return NextResponse.json({ error: apiT(request, "apiOrderNotFound") }, { status: 404 });
    }

    if (!canTransition(order.status, newStatus as SelfServiceStatus, user.role)) {
      return NextResponse.json(
        {
          error: apiT(request, "apiRoleCannotChangeStatus", { role: user.role, from: order.status, to: newStatus }),
        },
        { status: 403 }
      );
    }

    let finalStatus: string = newStatus;
    let paymentMethod: string | null = null;
    let txRow: any = null;
    const ticketLabel = order.ticket_number || "#" + orderId;

    try {
      if (newStatus === "PAID" && order.status === "PENDING_PAYMENT") {
        paymentMethod =
          paymentMethodRaw && VALID_PAYMENT.includes(paymentMethodRaw) ? paymentMethodRaw : "efectivo";
        finalStatus = "PREPARING"; // cobrado → cocina (el cliente ve "Pagado" como hecho)
        txRow = await withTransaction(async (client) => {
          const locked = (
            await client.query(`SELECT status FROM orders WHERE id = $1 FOR UPDATE`, [orderId])
          ).rows[0];
          if (locked?.status !== "PENDING_PAYMENT") {
            throw new ConflictError("Esta orden ya fue cobrada", "apiOrderAlreadyPaid");
          }
          await deductOrderStock(client, {
            orderId,
            userId: user.id,
            reason: `Venta autoservicio (ficho ${ticketLabel})`,
          });
          const upd = await client.query(
            `UPDATE orders
             SET status = $1, updated_at = NOW(), modified_by = $2, payment_method = $3, closed_at = NOW()
             WHERE id = $4
             RETURNING id, ticket_number, status, updated_at, public_token, payment_method, closed_at`,
            [finalStatus, user.id, paymentMethod, orderId]
          );
          return upd.rows[0];
        });
      } else if (newStatus === "CANCELLED" && STOCK_DEDUCTED_STATUSES.has(order.status)) {
        txRow = await withTransaction(async (client) => {
          const locked = (
            await client.query(`SELECT status FROM orders WHERE id = $1 FOR UPDATE`, [orderId])
          ).rows[0];
          if (locked?.status !== order.status) {
            throw new ConflictError("La orden cambió de estado, vuelve a intentarlo", "apiOrderNotModifiable");
          }
          await restoreStockForOrder(client, orderId, order.ticket_number, user.id);
          const upd = await client.query(
            `UPDATE orders SET status = $1, updated_at = NOW(), modified_by = $2
             WHERE id = $3 RETURNING id, ticket_number, status, updated_at, public_token`,
            [finalStatus, user.id, orderId]
          );
          return upd.rows[0];
        });
      }
    } catch (e) {
      return toErrorResponse(e);
    }

    const updated = txRow
      ? [txRow]
      : await sql`
          UPDATE orders
          SET status = ${finalStatus}, updated_at = NOW(), modified_by = ${user.id}
          WHERE id = ${orderId}
          RETURNING id, ticket_number, status, updated_at, public_token
        `;

    await logAudit({
      userId: user.id,
      action: "self_service_status_change",
      entityType: "order",
      entityId: orderId,
      details: `Ficho ${order.ticket_number}: ${order.status} -> ${finalStatus}${
        paymentMethod ? ` pago=${paymentMethod}` : ""
      }`,
    });

    // Web Push al cliente
    const ticket = order.ticket_number || `#${orderId}`;
    const trackUrl = order.public_token
      ? `/tracking/${order.public_token}`
      : "/";

    try {
      if (finalStatus === "PREPARING" && order.status === "PENDING_PAYMENT") {
        await notifyOrder(orderId, {
          title: `Pedido ${ticket} en preparación`,
          body: "Ya pagaste. Estamos preparando tu pedido.",
          url: trackUrl,
          tag: `order-${orderId}-preparing`,
        });
      } else if (finalStatus === "READY") {
        await notifyOrder(orderId, {
          title: `¡${ticket} listo para recoger!`,
          body: "Tu pedido está listo. Pasa a recogerlo.",
          url: trackUrl,
          tag: `order-${orderId}-ready`,
        });
      } else if (finalStatus === "COMPLETED") {
        await notifyOrder(orderId, {
          title: `Pedido ${ticket} entregado`,
          body: "¡Gracias por tu visita!",
          url: trackUrl,
          tag: `order-${orderId}-done`,
        });
      } else if (finalStatus === "CANCELLED") {
        await notifyOrder(orderId, {
          title: `Pedido ${ticket} cancelado`,
          body: "Tu pedido fue cancelado. Si tienes dudas, pregunta en caja.",
          url: trackUrl,
          tag: `order-${orderId}-cancel`,
        });
      }
    } catch (pushErr) {
      console.error("Push notify error (no bloquea la respuesta):", pushErr);
    }

    return NextResponse.json({ order: updated[0] }, { status: 200 });
  } catch (error) {
    console.error("Update self-service status error:", error);
    return NextResponse.json({ error: apiT(request, "internalServerError") }, { status: 500 });
  }
}
