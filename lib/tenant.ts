/**
 * Aislamiento multi-tenant (Fase 1 remediación).
 * Toda ruta con :id de recurso de bar debe usar uno de estos guards.
 * Si el recurso no pertenece al bar activo del usuario → 404 (no 403).
 * El rol "owner" (Superadmin de plataforma) bypasea el filtro de location.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { JWTPayload } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";

export type TenantOk = {
  error: null;
  locationId: number | null;
  /** fila cruda opcional */
  row?: Record<string, unknown>;
};

export type TenantFail = {
  error: NextResponse;
  locationId?: null;
  row?: undefined;
};

export type TenantResult = TenantOk | TenantFail;

function notFound(entity = "Recurso"): TenantFail {
  return {
    error: NextResponse.json({ error: `${entity} no encontrado` }, { status: 404 }),
  };
}

function noBar(): TenantFail {
  return {
    error: NextResponse.json({ error: "Sin bar asignado" }, { status: 400 }),
  };
}

/** location activo del usuario, o null si owner */
export async function getActorLocationId(
  user: JWTPayload
): Promise<{ locationId: number | null; error: NextResponse | null }> {
  if (user.role === "owner") {
    return { locationId: null, error: null };
  }
  const locationId = await resolveLocationId(user.id, user.role);
  if (!locationId) {
    return { locationId: null, error: NextResponse.json({ error: "Sin bar asignado" }, { status: 400 }) };
  }
  return { locationId, error: null };
}

export async function assertOwnsTable(
  tableId: number,
  user: JWTPayload
): Promise<TenantResult> {
  if (user.role === "owner") {
    const rows = await sql`SELECT * FROM tables WHERE id = ${tableId} LIMIT 1`;
    if (!rows[0]) return notFound("Mesa");
    return { error: null, locationId: rows[0].location_id as number, row: rows[0] };
  }
  const locationId = await resolveLocationId(user.id, user.role);
  if (!locationId) return noBar();
  const rows = await sql`
    SELECT * FROM tables
    WHERE id = ${tableId} AND location_id = ${locationId}
    LIMIT 1
  `;
  if (!rows[0]) return notFound("Mesa");
  return { error: null, locationId, row: rows[0] };
}

export async function assertOwnsProduct(
  productId: number,
  user: JWTPayload
): Promise<TenantResult> {
  if (user.role === "owner") {
    const rows = await sql`SELECT * FROM products WHERE id = ${productId} LIMIT 1`;
    if (!rows[0]) return notFound("Producto");
    return { error: null, locationId: rows[0].location_id as number, row: rows[0] };
  }
  const locationId = await resolveLocationId(user.id, user.role);
  if (!locationId) return noBar();
  const rows = await sql`
    SELECT * FROM products
    WHERE id = ${productId} AND location_id = ${locationId}
    LIMIT 1
  `;
  if (!rows[0]) return notFound("Producto");
  return { error: null, locationId, row: rows[0] };
}

/**
 * Orden dine-in: location vía tables.
 * Autoservicio: location vía productos de los ítems (o location_id en orders si existiera).
 */
export async function assertOwnsOrder(
  orderId: number,
  user: JWTPayload
): Promise<TenantResult> {
  const orders = await sql`SELECT * FROM orders WHERE id = ${orderId} LIMIT 1`;
  const order = orders[0];
  if (!order) return notFound("Orden");

  if (user.role === "owner") {
    let locationId: number | null = null;
    if (order.table_id) {
      const t = await sql`SELECT location_id FROM tables WHERE id = ${order.table_id} LIMIT 1`;
      locationId = t[0]?.location_id ?? null;
    } else {
      const p = await sql`
        SELECT p.location_id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ${orderId}
        LIMIT 1
      `;
      locationId = p[0]?.location_id ?? null;
    }
    return { error: null, locationId, row: order };
  }

  const locationId = await resolveLocationId(user.id, user.role);
  if (!locationId) return noBar();

  // dine-in
  if (order.table_id) {
    const t = await sql`
      SELECT location_id FROM tables
      WHERE id = ${order.table_id} AND location_id = ${locationId}
      LIMIT 1
    `;
    if (!t[0]) return notFound("Orden");
    return { error: null, locationId, row: order };
  }

  // self-service / sin mesa: ítems del bar
  const p = await sql`
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId} AND p.location_id = ${locationId}
    LIMIT 1
  `;
  if (!p[0]) {
    // orden sin ítems: denegar por seguridad
    return notFound("Orden");
  }
  return { error: null, locationId, row: order };
}

export async function assertOwnsReservation(
  reservationId: number,
  user: JWTPayload
): Promise<TenantResult> {
  if (user.role === "owner") {
    const rows = await sql`SELECT * FROM reservations WHERE id = ${reservationId} LIMIT 1`;
    if (!rows[0]) return notFound("Reserva");
    return { error: null, locationId: rows[0].location_id as number, row: rows[0] };
  }
  const locationId = await resolveLocationId(user.id, user.role);
  if (!locationId) return noBar();
  const rows = await sql`
    SELECT * FROM reservations
    WHERE id = ${reservationId} AND location_id = ${locationId}
    LIMIT 1
  `;
  if (!rows[0]) return notFound("Reserva");
  return { error: null, locationId, row: rows[0] };
}

export async function assertOwnsCashSession(
  sessionId: number,
  user: JWTPayload
): Promise<TenantResult> {
  if (user.role === "owner") {
    const rows = await sql`SELECT * FROM cash_sessions WHERE id = ${sessionId} LIMIT 1`;
    if (!rows[0]) return notFound("Sesión de caja");
    return { error: null, locationId: rows[0].location_id as number, row: rows[0] };
  }
  const locationId = await resolveLocationId(user.id, user.role);
  if (!locationId) return noBar();
  const rows = await sql`
    SELECT * FROM cash_sessions
    WHERE id = ${sessionId} AND location_id = ${locationId}
    LIMIT 1
  `;
  if (!rows[0]) return notFound("Sesión de caja");
  return { error: null, locationId, row: rows[0] };
}

/** Sucursal: solo owner o staff de esa location/org */
export async function assertOwnsLocation(
  locationIdParam: number,
  user: JWTPayload
): Promise<TenantResult> {
  if (user.role === "owner") {
    const rows = await sql`SELECT * FROM locations WHERE id = ${locationIdParam} LIMIT 1`;
    if (!rows[0]) return notFound("Sucursal");
    return { error: null, locationId: locationIdParam, row: rows[0] };
  }
  const locationId = await resolveLocationId(user.id, user.role);
  if (!locationId) return noBar();
  if (locationId !== locationIdParam) return notFound("Sucursal");
  const rows = await sql`SELECT * FROM locations WHERE id = ${locationIdParam} LIMIT 1`;
  if (!rows[0]) return notFound("Sucursal");
  return { error: null, locationId, row: rows[0] };
}
