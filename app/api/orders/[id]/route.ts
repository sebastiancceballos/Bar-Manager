import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { canCharge } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

const VALID_PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "otro"];

async function attachItems(order: any) {
  const items = await sql`
    SELECT oi.*, p.name as product_name, p.category
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ${order.id}
  `;
  order.items = items.map((item: any) => ({
    ...item,
    product: { name: item.product_name, price: item.price, category: item.category }
  }));
  return order;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    const body = await request.json();
    const {
      status,
      newTableId,
      paymentMethod,
      tipAmount,
      discountAmount,
      discountReason,
      authorizerEmail,
      authorizerPassword,
    } = body;

    // --- Transferir orden a otra mesa ---
    if (newTableId !== undefined) {
      const existing = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
      const current = existing[0];
      if (!current) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      // Permitir transferir cuentas en curso o con cuenta pedida
      if (current.status !== "open" && current.status !== "bill_requested") {
        return NextResponse.json(
          { error: "Solo se pueden transferir órdenes abiertas o con cuenta pedida" },
          { status: 400 }
        );
      }

      const targetTable = await sql`SELECT * FROM tables WHERE id = ${parseInt(newTableId)}`;
      if (targetTable.length === 0) {
        return NextResponse.json({ error: "Mesa destino no encontrada" }, { status: 404 });
      }
      const openOrderOnTarget = await sql`
        SELECT id FROM orders
        WHERE table_id = ${parseInt(newTableId)}
          AND status IN ('open', 'bill_requested')
      `;
      if (openOrderOnTarget.length > 0) {
        return NextResponse.json({ error: "La mesa destino ya tiene una orden abierta" }, { status: 409 });
      }

      let updated;
      try {
        updated = await sql`
          UPDATE orders
          SET table_id = ${parseInt(newTableId)}, updated_at = NOW(), modified_by = ${user.id}
          WHERE id = ${orderId}
          RETURNING *
        `;
      } catch {
        return NextResponse.json({ error: "No se pudo transferir (la mesa destino ya tiene una orden abierta)" }, { status: 409 });
      }

      const loc = await sql`SELECT location_id FROM tables WHERE id = ${current.table_id}`;
      await logAudit({
        locationId: loc[0]?.location_id ?? null,
        userId: user.id,
        action: "transfer_order",
        entityType: "order",
        entityId: orderId,
        details: `Mesa ${current.table_id} -> ${newTableId}`,
      });

      const order = await attachItems(updated[0]);
      return NextResponse.json({ order }, { status: 200 });
    }

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // --- Cerrar/cobrar orden (status: closed | paid) ---
    if (status === "closed" || status === "paid") {
      if (!canCharge(user.role)) {
        return NextResponse.json(
          {
            error:
              user.role === "waiter"
                ? "El mesero no puede cobrar ni cerrar la cuenta. Llama a caja."
                : "Sin permiso para cobrar",
          },
          { status: 403 }
        );
      }

      const existing = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
      const current = existing[0];
      if (!current) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
        return NextResponse.json(
          { error: "Método de pago inválido. Usa: " + VALID_PAYMENT_METHODS.join(", ") },
          { status: 400 }
        );
      }

      const tip = Number(tipAmount) || 0;
      let discount = Number(discountAmount) || 0;
      if (tip < 0 || discount < 0) {
        return NextResponse.json({ error: "Propina y descuento no pueden ser negativos" }, { status: 400 });
      }

      let discountAuthorizedBy: number | null = null;

      if (discount > 0) {
        if (user.role === "admin" || user.role === "owner") {
          discountAuthorizedBy = user.id;
        } else {
          // Un mesero necesita autorización de un admin/owner de ese mismo bar
          if (!authorizerEmail || !authorizerPassword) {
            return NextResponse.json(
              { error: "Para aplicar un descuento, un admin debe autorizar con su email y contraseña" },
              { status: 403 }
            );
          }
          const authRows = await sql`SELECT * FROM users WHERE email = ${authorizerEmail} LIMIT 1`;
          const authorizer = authRows[0];
          if (!authorizer || (authorizer.role !== "admin" && authorizer.role !== "owner")) {
            return NextResponse.json({ error: "Autorizador inválido" }, { status: 403 });
          }
          const validPw = await bcrypt.compare(authorizerPassword, authorizer.password_hash);
          if (!validPw) {
            return NextResponse.json({ error: "Contraseña de autorización incorrecta" }, { status: 403 });
          }
          discountAuthorizedBy = authorizer.id;
        }
        if (!discountReason || !discountReason.trim()) {
          return NextResponse.json({ error: "Debes indicar el motivo del descuento" }, { status: 400 });
        }
      }

      // Recalcular total: subtotal de items + IVA del bar - descuento + propina
      const subtotalRows = await sql`
        SELECT COALESCE(SUM(price * quantity), 0) as subtotal
        FROM order_items WHERE order_id = ${orderId}
      `;
      const subtotal = parseFloat(subtotalRows[0]?.subtotal || 0);
      if (discount > subtotal) discount = subtotal;

      const locRow = await sql`SELECT location_id FROM tables WHERE id = ${current.table_id}`;
      const locationId = locRow[0]?.location_id;
      const taxRow = await sql`SELECT tax_rate FROM locations WHERE id = ${locationId}`;
      const taxRate = parseFloat(taxRow[0]?.tax_rate || 0);
      const taxableAmount = subtotal - discount;
      const tax = Math.max(0, taxableAmount) * taxRate;
      const finalTotal = Math.max(0, taxableAmount) + tax + tip;

      // Stock al cobrar (misma regla que autoservicio)
      const lineItems = await sql`
        SELECT oi.product_id, oi.quantity, p.name, COALESCE(p.stock, 0) AS stock
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${orderId}
      `;
      for (const item of lineItems) {
        const stock = Number(item.stock) || 0;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;
        if (stock < qty) {
          return NextResponse.json(
            {
              error: `Sin stock suficiente de "${item.name}": hay ${stock}, se necesitan ${qty}. Repón inventario antes de cobrar.`,
            },
            { status: 400 }
          );
        }
      }
      for (const item of lineItems) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0 || !item.product_id) continue;
        await sql`
          UPDATE products
          SET stock = COALESCE(stock, 0) - ${qty}, updated_at = NOW()
          WHERE id = ${item.product_id}
        `;
        const reason = `Venta mesa (orden #${orderId})`;
        await sql`
          INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
          VALUES (${item.product_id}, ${qty}, 'sale', ${reason}, ${user.id})
        `;
      }

      const updated = await sql`
        UPDATE orders
        SET status = ${status},
            closed_at = NOW(),
            updated_at = NOW(),
            modified_by = ${user.id},
            payment_method = ${paymentMethod},
            tip_amount = ${tip},
            discount_amount = ${discount},
            discount_reason = ${discount > 0 ? discountReason : null},
            discount_authorized_by = ${discountAuthorizedBy},
            subtotal_amount = ${subtotal},
            tax_amount = ${tax},
            total_amount = ${finalTotal}
        WHERE id = ${orderId}
        RETURNING *
      `;

      const amountReceived = Number(body.amountReceived);
      const changeDue =
        Number.isFinite(amountReceived) && amountReceived > 0
          ? Math.max(0, amountReceived - finalTotal)
          : null;

      await logAudit({
        locationId,
        userId: user.id,
        action: "close_order",
        entityType: "order",
        entityId: orderId,
        details: `pago=${paymentMethod} propina=${tip} descuento=${discount}${discount > 0 ? ` (${discountReason}, autorizado por #${discountAuthorizedBy})` : ""} total=${finalTotal}${
          Number.isFinite(amountReceived) ? ` recibe=${amountReceived} vuelto=${changeDue}` : ""
        }`,
      });

      const order = await attachItems(updated[0]);
      return NextResponse.json({ order, breakdown: { subtotal, discount, tax, taxRate, tip, total: finalTotal } }, { status: 200 });
    }

    // --- Cambio de estado manual (sin cobro) ---
    const MANUAL_STATUSES = ["open", "bill_requested"];
    if (user.role === "waiter") {
      // Mesero solo puede pedir cuenta (bill_requested) o mantener open
      if (status !== "bill_requested" && status !== "open") {
        return NextResponse.json(
          { error: "El mesero solo puede marcar 'Cuenta pedida' o dejar la orden abierta" },
          { status: 403 }
        );
      }
    } else if (!canCharge(user.role)) {
      // kitchen u otros roles sin cobro
      return NextResponse.json({ error: "Sin permiso para cambiar estado" }, { status: 403 });
    }

    if (!MANUAL_STATUSES.includes(status) && status !== "closed" && status !== "paid") {
      // permitir solo estados conocidos de mesa
      if (!["open", "bill_requested", "paid", "closed"].includes(status)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
    }

    const orders = await sql`
      UPDATE orders 
      SET status = ${status}, updated_at = NOW(), modified_by = ${user.id}
      WHERE id = ${orderId}
      RETURNING *
    `;

    const order = await attachItems(orders[0]);
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const orders = await sql`SELECT * FROM orders WHERE id = ${parseInt(id)}`;
    let order = orders[0];

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    order = await attachItems(order);
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Get order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
