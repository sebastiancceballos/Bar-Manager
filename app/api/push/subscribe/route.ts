import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { toErrorResponse } from "@/lib/errors";

/**
 * POST body:
 * {
 *   endpoint, keys: { p256dh, auth },
 *   publicToken?: string,   // cliente tracking (scope order)
 *   scope?: "order" | "staff"
 * }
 * Staff: location_id SIEMPRE del servidor (resolveLocationId), nunca del body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    const scope = body?.scope === "staff" ? "staff" : "order";
    const publicToken = body?.publicToken as string | undefined;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Suscripción incompleta (endpoint/keys)" },
        { status: 400 }
      );
    }

    let orderId: number | null = null;
    let token: string | null = null;
    let locId: number | null = null;
    let userId: number | null = null;

    if (scope === "order") {
      if (!publicToken) {
        return NextResponse.json(
          { error: "publicToken requerido para notificaciones del pedido" },
          { status: 400 }
        );
      }
      const rows = await sql`
        SELECT id, public_token FROM orders
        WHERE public_token = ${publicToken} AND order_type = 'self_service'
        LIMIT 1
      `;
      if (!rows[0]) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      }
      orderId = rows[0].id;
      token = rows[0].public_token;
    } else {
      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
      userId = user.id;
      // Nunca confiar en body.locationId (aislamiento multi-tenant)
      locId = await resolveLocationId(user.id, user.role);
      if (!locId) {
        return NextResponse.json(
          { error: "Sin bar asignado para notificaciones del personal" },
          { status: 400 }
        );
      }
    }

    await sql`
      INSERT INTO push_subscriptions (
        endpoint, p256dh, auth, order_id, public_token, location_id, user_id, scope
      )
      VALUES (
        ${endpoint}, ${p256dh}, ${auth},
        ${orderId}, ${token}::uuid, ${locId}, ${userId}, ${scope}
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        order_id = COALESCE(EXCLUDED.order_id, push_subscriptions.order_id),
        public_token = COALESCE(EXCLUDED.public_token, push_subscriptions.public_token),
        location_id = EXCLUDED.location_id,
        user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id),
        scope = EXCLUDED.scope
    `;

    return NextResponse.json({ ok: true, locationId: locId }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
