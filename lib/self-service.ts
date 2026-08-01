import { sql } from "./db";
import type { UserRole } from "./auth";

export type SelfServiceStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export const SELF_SERVICE_STATUSES: SelfServiceStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

/** Estados que representan una venta cobrada (entran a ingresos/reportes). */
export const REVENUE_STATUSES = [
  "closed",
  "paid",
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
] as const;

/**
 * Quién puede mover un pedido de autoservicio de un estado a otro.
 * owner/admin: supervisión.
 * cashier: cobra (PENDING_PAYMENT -> PAID; el API avanza a PREPARING)
 *         y marca entregado (READY -> COMPLETED).
 * waiter/kitchen: preparan (PAID/PREPARING -> READY) en Comandas.
 */
const TRANSITIONS: Record<SelfServiceStatus, Partial<Record<SelfServiceStatus, UserRole[]>>> = {
  PENDING_PAYMENT: {
    PAID: ["cashier", "admin", "owner"],
    CANCELLED: ["cashier", "admin", "owner"],
  },
  PAID: {
    PREPARING: ["waiter", "kitchen", "admin", "owner", "cashier"],
    CANCELLED: ["cashier", "admin", "owner"],
  },
  PREPARING: {
    READY: ["waiter", "kitchen", "admin", "owner"],
    CANCELLED: ["cashier", "admin", "owner"],
  },
  READY: {
    COMPLETED: ["cashier", "admin", "owner"],
    CANCELLED: ["cashier", "admin", "owner"],
  },
  COMPLETED: {},
  CANCELLED: {},
};

export function canTransition(
  from: string,
  to: SelfServiceStatus,
  role: UserRole
): boolean {
  const allowedRoles = TRANSITIONS[from as SelfServiceStatus]?.[to];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Genera el siguiente número de ficho del día para un bar.
 * Se reinicia a #0001 cada día a las 00:00 (fecha local del bar, timezone
 * de locations.timezone o America/Bogota).
 *
 * Atómico: usa UPSERT sobre ticket_counters + PRIMARY KEY (location_id, period_date)
 * para que dos clientes confirmando al mismo tiempo no reciban el mismo número.
 *
 * Formato: #0001, #0002, ... #9999, #10000 (sin truncar).
 * Los pedidos de días anteriores conservan su ticket_number histórico.
 */
export async function generateTicketNumber(locationId: number): Promise<string> {
  // Fecha "hoy" en la zona del bar (no UTC del servidor)
  const dateRows = await sql`
    SELECT (
      (NOW() AT TIME ZONE 'UTC' AT TIME ZONE COALESCE(
        (SELECT timezone FROM locations WHERE id = ${locationId} LIMIT 1),
        'America/Bogota'
      ))
    )::date AS period_date
  `;
  const periodDate = dateRows[0]?.period_date;
  if (!periodDate) {
    throw new Error("No se pudo determinar la fecha local del bar para el ficho");
  }

  const rows = await sql`
    INSERT INTO ticket_counters (location_id, period_date, last_number)
    VALUES (${locationId}, ${periodDate}::date, 1)
    ON CONFLICT (location_id, period_date)
    DO UPDATE SET last_number = ticket_counters.last_number + 1
    RETURNING last_number
  `;
  const n = Number(rows[0].last_number);
  return `#${String(n).padStart(4, "0")}`;
}
