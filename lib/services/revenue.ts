import { sql } from "@/lib/db";
import { getLocationTimezone } from "@/lib/location";

/** Estados que cuentan como ingreso (cobrado / en flujo post-pago SS) */
export const REVENUE_STATUSES = [
  "closed",
  "paid",
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
] as const;

/**
 * Fecha de negocio del cobro: closed_at si existe, si no created_at.
 * Comparada en la timezone del local.
 */
export async function locationRevenueToday(locationId: number): Promise<{
  revenue: number;
  orderCount: number;
  timezone: string;
}> {
  const tz = await getLocationTimezone(locationId);
  const rows = await sql`
    SELECT
      COALESCE(SUM(o.total_amount), 0) AS revenue,
      COUNT(*)::int AS order_count
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
      AND (
        t.location_id = ${locationId}
        OR EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id AND p.location_id = ${locationId}
        )
      )
      AND DATE(
        COALESCE(o.closed_at, o.created_at) AT TIME ZONE 'UTC' AT TIME ZONE ${tz}
      ) = (CURRENT_TIMESTAMP AT TIME ZONE ${tz})::date
  `;
  return {
    revenue: Number(rows[0]?.revenue || 0),
    orderCount: Number(rows[0]?.order_count || 0),
    timezone: tz,
  };
}

/** Ingresos del mes calendario actual en TZ del local */
export async function locationRevenueMonth(locationId: number): Promise<number> {
  const tz = await getLocationTimezone(locationId);
  const rows = await sql`
    SELECT COALESCE(SUM(o.total_amount), 0) AS revenue
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
      AND (
        t.location_id = ${locationId}
        OR EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id AND p.location_id = ${locationId}
        )
      )
      AND DATE_TRUNC(
        'month',
        COALESCE(o.closed_at, o.created_at) AT TIME ZONE 'UTC' AT TIME ZONE ${tz}
      ) = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE ${tz})
  `;
  return Number(rows[0]?.revenue || 0);
}
