/**
 * Handlers de reportes por type (Fase 6).
 * Comportamiento equivalente al GET monolítico anterior.
 */
import { sql } from "@/lib/db";
import { getLocationTimezone } from "@/lib/location";
import { reportCutoffIso } from "@/lib/services/reports-scope";

const PAID = `('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')`;

function intervalSql(range: string): string {
  if (range === "month") return "30 days";
  if (range === "year") return "365 days";
  return "7 days";
}

async function belongsToLocationClause(locId: number, tz: string, interval: string) {
  // shared filter concept — each query inlines for neon tagged templates
  return { locId, tz, interval };
}

export async function reportOrgSummary(locId: number, range: string) {
  const interval = intervalSql(range);
  const tz = await getLocationTimezone(locId);
  const cutoffIso = reportCutoffIso(range);
  const orgRow = await sql`
    SELECT organization_id FROM locations WHERE id = ${locId} LIMIT 1
  `;
  const orgId = orgRow[0]?.organization_id;
  if (!orgId) {
    return { error: "Esta sucursal no tiene organización asignada", status: 400 as const };
  }
  const rows = await sql`
    SELECT
      l.id as location_id,
      l.name as location_name,
      COALESCE(SUM(o.total_amount), 0) as total,
      COUNT(o.id) as order_count
    FROM locations l
    LEFT JOIN orders o ON (
      o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
      AND o.created_at >= ${cutoffIso}::timestamptz
      AND (
        EXISTS (SELECT 1 FROM tables t WHERE t.id = o.table_id AND t.location_id = l.id)
        OR EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id AND p.location_id = l.id
        )
      )
    )
    WHERE l.organization_id = ${orgId}
    GROUP BY l.id, l.name
    ORDER BY l.name
  `;
  const grandTotal = rows.reduce((s: number, r: any) => s + parseFloat(String(r.total || 0)), 0);
  const grandOrders = rows.reduce((s: number, r: any) => s + parseInt(String(r.order_count || 0), 10), 0);
  return {
    data: {
      scope: "organization",
      organizationId: orgId,
      locations: rows,
      totals: { total: grandTotal, order_count: grandOrders },
      range,
    },
  };
}

export async function reportByWaiter(locId: number, range: string) {
  const interval = intervalSql(range);
  const tz = await getLocationTimezone(locId);
  const cutoffIso = reportCutoffIso(range);
  const rows = await sql`
    SELECT
      CASE WHEN o.order_type = 'self_service' THEN NULL ELSE u.id END as waiter_id,
      CASE WHEN o.order_type = 'self_service' THEN 'Autoservicio' ELSE COALESCE(u.name, 'Sin asignar') END as waiter_name,
      COUNT(*) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total,
      COALESCE(SUM(o.tip_amount), 0) as total_tips
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.waiter_id = u.id
    WHERE o.created_at >= ${cutoffIso}::timestamptz
      AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
      AND (
        t.location_id = ${locId}
        OR EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id AND p.location_id = ${locId}
        )
      )
    GROUP BY 1, 2
    ORDER BY total DESC
  `;
  return {
    byWaiter: rows.map((r: any) => ({
      waiterId: r.waiter_id,
      waiterName: r.waiter_name,
      orderCount: Number(r.order_count),
      total: Number(r.total),
      totalTips: Number(r.total_tips),
    })),
  };
}

export async function reportTopProducts(locId: number, range: string) {
  const interval = intervalSql(range);
  const tz = await getLocationTimezone(locId);
  const cutoffIso = reportCutoffIso(range);
  const rows = await sql`
    SELECT
      p.name as product_name,
      p.category,
      COALESCE(SUM(oi.quantity), 0) as units_sold,
      COALESCE(SUM(oi.quantity * oi.price), 0) as total
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.created_at >= ${cutoffIso}::timestamptz
      AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
      AND p.location_id = ${locId}
    GROUP BY p.id, p.name, p.category
    ORDER BY units_sold DESC
    LIMIT 20
  `;
  return {
    topProducts: rows.map((r: any) => ({
      productName: r.product_name,
      category: r.category,
      unitsSold: Number(r.units_sold),
      total: Number(r.total),
    })),
  };
}

export async function reportByPaymentMethod(locId: number, range: string) {
  const interval = intervalSql(range);
  const tz = await getLocationTimezone(locId);
  const cutoffIso = reportCutoffIso(range);
  const rows = await sql`
    SELECT
      COALESCE(o.payment_method, 'sin_dato') as payment_method,
      COUNT(*) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.created_at >= ${cutoffIso}::timestamptz
      AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
      AND (
        t.location_id = ${locId}
        OR EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id AND p.location_id = ${locId}
        )
      )
    GROUP BY 1
    ORDER BY total DESC
  `;
  return {
    byPaymentMethod: rows.map((r: any) => ({
      paymentMethod: r.payment_method,
      orderCount: Number(r.order_count),
      total: Number(r.total),
    })),
  };
}

export async function reportByOrderType(locId: number, range: string) {
  const interval = intervalSql(range);
  const tz = await getLocationTimezone(locId);
  const cutoffIso = reportCutoffIso(range);
  const rows = await sql`
    SELECT
      COALESCE(o.order_type, 'dine_in') as order_type,
      COUNT(*) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.created_at >= ${cutoffIso}::timestamptz
      AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
      AND (
        t.location_id = ${locId}
        OR EXISTS (
          SELECT 1 FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id AND p.location_id = ${locId}
        )
      )
    GROUP BY 1
  `;
  return {
    byOrderType: rows.map((r: any) => ({
      orderType: r.order_type,
      orderCount: Number(r.order_count),
      total: Number(r.total),
    })),
  };
}

export async function reportTimeseries(locId: number, range: string) {
  const interval = intervalSql(range);
  const tz = await getLocationTimezone(locId);
  const cutoffIso = reportCutoffIso(range);
  const reports = await sql`
    WITH localized AS (
      SELECT
        (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date as day,
        o.total_amount,
        o.id
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.created_at >= ${cutoffIso}::timestamptz
        AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
        AND (
          t.location_id = ${locId}
          OR EXISTS (
            SELECT 1 FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = o.id AND p.location_id = ${locId}
          )
        )
    )
    SELECT
      day::text as date,
      COALESCE(SUM(total_amount), 0) as total,
      COUNT(id) as order_count
    FROM localized
    GROUP BY day
    ORDER BY day ASC
  `;
  return {
    reports: reports.map((r: any) => ({
      date: r.date,
      total: Number(r.total),
      orderCount: Number(r.order_count),
    })),
  };
}
