import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getLocationTimezone } from "@/lib/location";

/** Estados que cuentan como venta cobrada (dine-in + autoservicio). */
const PAID_STATUSES_SQL = `('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')`;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "week";
    const type = searchParams.get("type") || "timeseries";

    let interval = "7 days";
    switch (range) {
      case "month":
        interval = "30 days";
        break;
      case "year":
        interval = "365 days";
        break;
      case "week":
      default:
        interval = "7 days";
    }

    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id;
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const tz = await getLocationTimezone(locId);

    // Un pedido pertenece al bar si:
    // - tiene mesa de ese bar (dine_in), o
    // - tiene ítems de productos de ese bar (self_service, sin mesa).
    // Neon no permite fragmentos SQL dinámicos en el template, así que
    // cada query repite la condición EXISTS / LEFT JOIN tables.

    if (type === "by-waiter") {
      const rows = await sql`
        SELECT
          CASE
            WHEN o.order_type = 'self_service' THEN NULL
            ELSE u.id
          END as waiter_id,
          CASE
            WHEN o.order_type = 'self_service' THEN 'Autoservicio'
            ELSE COALESCE(u.name, 'Sin asignar')
          END as waiter_name,
          COUNT(*) as order_count,
          COALESCE(SUM(o.total_amount), 0) as total,
          COALESCE(SUM(o.tip_amount), 0) as total_tips
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN users u ON o.waiter_id = u.id
        WHERE (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= (NOW() AT TIME ZONE ${tz}) - ${interval}::interval
          AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
          AND (
            t.location_id = ${locId}
            OR EXISTS (
              SELECT 1 FROM order_items oi
              JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = o.id AND p.location_id = ${locId}
            )
          )
        GROUP BY
          CASE WHEN o.order_type = 'self_service' THEN NULL ELSE u.id END,
          CASE WHEN o.order_type = 'self_service' THEN 'Autoservicio' ELSE COALESCE(u.name, 'Sin asignar') END
        ORDER BY total DESC
      `;
      return NextResponse.json({
        byWaiter: rows.map(r => ({
          waiterId: r.waiter_id,
          waiterName: r.waiter_name,
          orderCount: parseInt(r.order_count),
          total: parseFloat(r.total),
          totalTips: parseFloat(r.total_tips),
        })),
      }, { status: 200 });
    }

    if (type === "top-products") {
      const rows = await sql`
        SELECT
          p.name as product_name,
          p.category,
          SUM(oi.quantity) as units_sold,
          SUM(oi.quantity * oi.price) as total
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= (NOW() AT TIME ZONE ${tz}) - ${interval}::interval
          AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
          AND p.location_id = ${locId}
        GROUP BY p.id, p.name, p.category
        ORDER BY units_sold DESC
        LIMIT 20
      `;
      return NextResponse.json({
        topProducts: rows.map(r => ({
          productName: r.product_name,
          category: r.category,
          unitsSold: parseInt(r.units_sold),
          total: parseFloat(r.total),
        })),
      }, { status: 200 });
    }

    if (type === "by-payment-method") {
      const rows = await sql`
        SELECT
          COALESCE(o.payment_method, CASE WHEN o.order_type = 'self_service' THEN 'autoservicio' ELSE 'sin_registrar' END) as payment_method,
          COUNT(*) as order_count,
          COALESCE(SUM(o.total_amount), 0) as total
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= (NOW() AT TIME ZONE ${tz}) - ${interval}::interval
          AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
          AND (
            t.location_id = ${locId}
            OR EXISTS (
              SELECT 1 FROM order_items oi
              JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = o.id AND p.location_id = ${locId}
            )
          )
        GROUP BY COALESCE(o.payment_method, CASE WHEN o.order_type = 'self_service' THEN 'autoservicio' ELSE 'sin_registrar' END)
        ORDER BY total DESC
      `;
      return NextResponse.json({
        byPaymentMethod: rows.map(r => ({
          paymentMethod: r.payment_method,
          orderCount: parseInt(r.order_count),
          total: parseFloat(r.total),
        })),
      }, { status: 200 });
    }

    if (type === "by-order-type") {
      const rows = await sql`
        SELECT
          COALESCE(o.order_type, 'dine_in') as order_type,
          COUNT(*) as order_count,
          COALESCE(SUM(o.total_amount), 0) as total
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= (NOW() AT TIME ZONE ${tz}) - ${interval}::interval
          AND o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
          AND (
            t.location_id = ${locId}
            OR EXISTS (
              SELECT 1 FROM order_items oi
              JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = o.id AND p.location_id = ${locId}
            )
          )
        GROUP BY COALESCE(o.order_type, 'dine_in')
        ORDER BY total DESC
      `;
      return NextResponse.json({
        byOrderType: rows.map(r => ({
          orderType: r.order_type,
          orderCount: parseInt(r.order_count),
          total: parseFloat(r.total),
        })),
      }, { status: 200 });
    }

    // type === "timeseries" (default)
    const reports = await sql`
      WITH localized AS (
        SELECT
          o.total_amount,
          (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) AS local_time
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE o.status IN ('closed', 'paid', 'PAID', 'PREPARING', 'READY', 'COMPLETED')
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
        DATE(local_time) AS report_date,
        COALESCE(SUM(total_amount), 0) AS total,
        COUNT(*) AS order_count
      FROM localized
      WHERE local_time >= (NOW() AT TIME ZONE ${tz}) - ${interval}::interval
      GROUP BY DATE(local_time)
      ORDER BY report_date ASC
    `;

    return NextResponse.json({
      reports: reports.map(r => ({
        date: r.report_date,
        total: parseFloat(r.total),
        orderCount: parseInt(r.order_count)
      }))
    }, { status: 200 });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
