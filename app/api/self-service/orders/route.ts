import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateTicketNumber } from "@/lib/self-service";
import { getAuthUser } from "@/lib/auth";

const ALLOWED_ROLES = ["owner", "admin", "cashier", "kitchen"];

// Panel de caja/cocina: lista de pedidos de autoservicio del bar del usuario,
// con filtro opcional por estado (?status=PAID) y búsqueda por número de
// ficho (?ticket=0042). Se consulta por polling desde el frontend.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const ticketSearch = searchParams.get("ticket");

    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    // owner no tiene location_id propio; en ese caso ve todo (supervisión).
    const locId = locRow[0]?.location_id ?? null;
    if (!locId && user.role !== "owner") {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    // Limpieza "al vuelo": no dependemos de un cron de Vercel (los crons
    // frecuentes requieren plan Pro). En cambio, cada vez que caja o cocina
    // consultan esta lista (lo hacen por polling cada 4-5s mientras el panel
    // está abierto), aprovechamos para cancelar los pedidos que llevan más
    // de 1 hora esperando el pago. Nunca falla la respuesta si esto falla.
    try {
      await sql`
        UPDATE orders
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE order_type = 'self_service'
          AND status = 'PENDING_PAYMENT'
          AND created_at < NOW() - INTERVAL '1 hour'
      `;
    } catch (cleanupError) {
      console.error("Stale self-service order cleanup failed:", cleanupError);
    }

    // Nota: el driver neon() solo soporta interpolar VALORES como parámetros
    // en el template, no componer fragmentos de SQL dinámicos — por eso cada
    // combinación de filtros va como su propia query completa en vez de
    // armar el WHERE por partes.
    let orders;
    if (ticketSearch) {
      orders = locId
        ? await sql`
            SELECT o.* FROM orders o
            WHERE o.order_type = 'self_service'
              AND o.ticket_number ILIKE ${"%" + ticketSearch + "%"}
              AND o.id IN (
                SELECT oi.order_id FROM order_items oi
                JOIN products p ON oi.product_id = p.id WHERE p.location_id = ${locId}
              )
            ORDER BY o.created_at DESC LIMIT 50
          `
        : await sql`
            SELECT o.* FROM orders o
            WHERE o.order_type = 'self_service' AND o.ticket_number ILIKE ${"%" + ticketSearch + "%"}
            ORDER BY o.created_at DESC LIMIT 50
          `;
    } else if (statusFilter) {
      orders = locId
        ? await sql`
            SELECT o.* FROM orders o
            WHERE o.order_type = 'self_service' AND o.status = ${statusFilter}
              AND o.id IN (
                SELECT oi.order_id FROM order_items oi
                JOIN products p ON oi.product_id = p.id WHERE p.location_id = ${locId}
              )
            ORDER BY o.created_at ASC LIMIT 100
          `
        : await sql`
            SELECT o.* FROM orders o
            WHERE o.order_type = 'self_service' AND o.status = ${statusFilter}
            ORDER BY o.created_at ASC LIMIT 100
          `;
    } else {
      orders = locId
        ? await sql`
            SELECT o.* FROM orders o
            WHERE o.order_type = 'self_service' AND o.status NOT IN ('COMPLETED', 'CANCELLED')
              AND o.id IN (
                SELECT oi.order_id FROM order_items oi
                JOIN products p ON oi.product_id = p.id WHERE p.location_id = ${locId}
              )
            ORDER BY o.created_at ASC LIMIT 100
          `
        : await sql`
            SELECT o.* FROM orders o
            WHERE o.order_type = 'self_service' AND o.status NOT IN ('COMPLETED', 'CANCELLED')
            ORDER BY o.created_at ASC LIMIT 100
          `;
    }

    for (const order of orders) {
      const items = await sql`
        SELECT oi.quantity, oi.notes, p.name, p.price
        FROM order_items oi JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${order.id}
      `;
      order.items = items;
    }

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("List self-service orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface CartItem {
  productId: number;
  quantity: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const locationId = parseInt(body.locationId);
    const clientName: string | undefined = body.clientName?.trim() || undefined;
    const customerNotes: string | undefined = body.customerNotes?.trim() || undefined;
    const items: CartItem[] = Array.isArray(body.items) ? body.items : [];

    if (!locationId || Number.isNaN(locationId)) {
      return NextResponse.json({ error: "Bar inválido" }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
    }

    const locationRows = await sql`
      SELECT id, self_service_enabled FROM locations WHERE id = ${locationId} AND active = true LIMIT 1
    `;
    if (locationRows.length === 0 || !locationRows[0].self_service_enabled) {
      return NextResponse.json(
        { error: "El autoservicio no está disponible en este bar" },
        { status: 403 }
      );
    }

    // Traer los productos desde la BD (nunca confiar en el precio que manda
    // el cliente) y validar que pertenezcan a este bar y estén disponibles.
    const productIds = items.map((i) => parseInt(String(i.productId))).filter((n) => !Number.isNaN(n));
    if (productIds.length === 0) {
      return NextResponse.json({ error: "Productos inválidos" }, { status: 400 });
    }

    const products = await sql`
      SELECT id, name, price FROM products
      WHERE location_id = ${locationId} AND available = true AND id = ANY(${productIds})
    `;
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    let total = 0;
    const validItems: { productId: number; quantity: number; notes?: string; price: number }[] = [];
    for (const item of items) {
      const productId = parseInt(String(item.productId));
      const product = productMap.get(productId);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      if (!product) {
        return NextResponse.json(
          { error: `Uno de los productos ya no está disponible` },
          { status: 400 }
        );
      }
      total += Number(product.price) * quantity;
      validItems.push({ productId, quantity, notes: item.notes?.trim() || undefined, price: Number(product.price) });
    }

    const ticketNumber = await generateTicketNumber();

    const orderRows = await sql`
      INSERT INTO orders (
        table_id, waiter_id, status, total_amount, order_type,
        ticket_number, client_name, customer_notes
      )
      VALUES (
        NULL, NULL, 'PENDING_PAYMENT', ${total}, 'self_service',
        ${ticketNumber}, ${clientName ?? null}, ${customerNotes ?? null}
      )
      RETURNING id, ticket_number, public_token, status, total_amount, created_at
    `;
    const order = orderRows[0];

    for (const item of validItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, price, notes)
        VALUES (${order.id}, ${item.productId}, ${item.quantity}, ${item.price}, ${item.notes ?? null})
      `;
    }

    await logAudit({
      locationId,
      action: "self_service_order_created",
      entityType: "order",
      entityId: order.id,
      details: `Ficho ${ticketNumber} creado por autoservicio (total: ${total})`,
    });

    return NextResponse.json(
      {
        order: {
          id: order.id,
          ticketNumber: order.ticket_number,
          trackingToken: order.public_token,
          status: order.status,
          total: order.total_amount,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create self-service order error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
