import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// NOTA: este endpoint quedó sin usar por defecto. La limpieza de pedidos
// vencidos ahora se hace "al vuelo" dentro de GET /api/self-service/orders
// (se ejecuta cada vez que caja/cocina consultan la lista, cada 4-5s
// mientras el panel está abierto), para no depender de Vercel Cron con
// intervalos frecuentes, que requiere plan Pro.
//
// Si en el futuro pasas a plan Pro y quieres una limpieza que corra incluso
// con los paneles cerrados, puedes reactivar esto agregando de nuevo un
// vercel.json con:
//   { "crons": [{ "path": "/api/cron/cancel-stale-orders", "schedule": "*/15 * * * *" }] }
// y definiendo la variable de entorno CRON_SECRET en Vercel.

// Vercel invoca esta ruta según el schedule definido en vercel.json y añade
// el header Authorization: Bearer <CRON_SECRET> automáticamente si defines
// la variable de entorno CRON_SECRET en el proyecto. Sin esto, cualquiera
// podría llamar la ruta y empezar a cancelar pedidos ajenos.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("CRON_SECRET no configurado; rechazando por seguridad.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cancelled = await sql`
      UPDATE orders
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE order_type = 'self_service'
        AND status = 'PENDING_PAYMENT'
        AND created_at < NOW() - INTERVAL '1 hour'
      RETURNING id, ticket_number
    `;

    for (const order of cancelled) {
      await logAudit({
        action: "self_service_auto_cancel",
        entityType: "order",
        entityId: order.id,
        details: `Ficho ${order.ticket_number} cancelado automáticamente por falta de pago (1h)`,
      });
    }

    return NextResponse.json({ cancelled: cancelled.length }, { status: 200 });
  } catch (error) {
    console.error("Cron cancel-stale-orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
