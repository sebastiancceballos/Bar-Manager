import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canTransition, SELF_SERVICE_STATUSES, SelfServiceStatus } from "@/lib/self-service";
import { notifyOrder } from "@/lib/push";

const ALLOWED_ROLES = ["owner", "admin", "cashier", "waiter", "kitchen"];

const STOCK_DEDUCTED_STATUSES = new Set(["PAID", "PREPARING", "READY", "COMPLETED"]);

async function deductStockForOrder(
  orderId: number,
  ticketNumber: string | null,
  userId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const items = await sql`
    SELECT oi.product_id, oi.quantity, p.name, COALESCE(p.stock, 0) AS stock
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ${orderId}
  `;

  for (const item of items) {
    const stock = Number(item.stock) || 0;
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    if (stock < qty) {
      return {
        ok: false,
        error: `Sin stock suficiente de "${item.name}": hay ${stock}, se necesitan ${qty}. Repón inventario antes de cobrar.`,
      };
    }
  }

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0 || !item.product_id) continue;

    await sql`
      UPDATE products
      SET stock = COALESCE(stock, 0) - ${qty}, updated_at = NOW()
      WHERE id = ${item.product_id}
    `;

    const reason = `Venta autoservicio (ficho ${ticketNumber || "#" + orderId})`;
    await sql`
      INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
      VALUES (${item.product_id}, ${qty}, 'sale', ${reason}, ${userId})
    `;
  }

  return { ok: true };
}

async function restoreStockForOrder(
  orderId: number,
  ticketNumber: string | null,
  userId: number
): Promise<void> {
  const items = await sql`
    SELECT oi.product_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = ${orderId} AND oi.product_id IS NOT NULL
  `;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    await sql`
      UPDATE products
      SET stock = COALESCE(stock, 0) + ${qty}, updated_at = NOW()
      WHERE id = ${item.product_id}
    `;

    const reason = `Cancelación autoservicio (ficho ${ticketNumber || "#" + orderId})`;
    await sql`
      INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
      VALUES (${item.product_id}, ${qty}, 'entry', ${reason}, ${userId})
    `;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    const body = await request.json();
    const newStatus = body.status;
    const paymentMethodRaw = body.paymentMethod as string | undefined;
    const VALID_PAYMENT = ["efectivo", "tarjeta", "transferencia", "otro"];

    if (!SELF_SERVICE_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, status, order_type, ticket_number, public_token
      FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    const order = rows[0];
    if (!order || order.order_type !== "self_service") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (!canTransition(order.status, newStatus as SelfServiceStatus, user.role)) {
      return NextResponse.json(
        {
          error: `Tu rol (${user.role}) no puede pasar el pedido de ${order.status} a ${newStatus}`,
        },
        { status: 403 }
      );
    }

    let finalStatus: string = newStatus;

    if (newStatus === "PAID" && order.status === "PENDING_PAYMENT") {
      const result = await deductStockForOrder(
        orderId,
        order.ticket_number,
        user.id
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      // Cobrado → cocina (timeline del cliente sigue mostrando "Pagado" como hecho)
      finalStatus = "PREPARING";
    }

    if (
      newStatus === "CANCELLED" &&
      STOCK_DEDUCTED_STATUSES.has(order.status)
    ) {
      await restoreStockForOrder(orderId, order.ticket_number, user.id);
    }

    // Al cobrar: método de pago + closed_at (para arqueo de caja)
    let paymentMethod: string | null = null;
    let setClosedAt = false;
    if (newStatus === "PAID" && order.status === "PENDING_PAYMENT") {
      paymentMethod =
        paymentMethodRaw && VALID_PAYMENT.includes(paymentMethodRaw)
          ? paymentMethodRaw
          : "efectivo";
      setClosedAt = true;
    }

    const updated = setClosedAt
      ? await sql`
          UPDATE orders
          SET status = ${finalStatus},
              updated_at = NOW(),
              modified_by = ${user.id},
              payment_method = ${paymentMethod},
              closed_at = NOW()
          WHERE id = ${orderId}
          RETURNING id, ticket_number, status, updated_at, public_token, payment_method, closed_at
        `
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
