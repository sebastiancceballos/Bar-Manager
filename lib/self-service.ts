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

/**
 * Quién puede mover un pedido de autoservicio de un estado a otro.
 * owner/admin pueden hacer cualquier transición válida (supervisión).
 * cashier: cobra (PENDING_PAYMENT -> PAID) y entrega (READY -> COMPLETED).
 * kitchen: prepara (PAID -> PREPARING) y termina (PREPARING -> READY).
 */
const TRANSITIONS: Record<SelfServiceStatus, Partial<Record<SelfServiceStatus, UserRole[]>>> = {
  PENDING_PAYMENT: {
    PAID: ["cashier", "admin", "owner"],
    CANCELLED: ["cashier", "admin", "owner"],
  },
  PAID: {
    PREPARING: ["kitchen", "admin", "owner"],
    CANCELLED: ["cashier", "admin", "owner"],
  },
  PREPARING: {
    READY: ["kitchen", "admin", "owner"],
  },
  READY: {
    COMPLETED: ["cashier", "admin", "owner"],
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
 * Genera el siguiente número de ficho de forma atómica usando una SEQUENCE
 * de Postgres (nextval es seguro ante llamadas concurrentes: dos clientes
 * confirmando su pedido al mismo tiempo nunca reciben el mismo número).
 * Formato: #0001, #0002, ... #9999, #10000 (deja de rellenar con ceros
 * después de 4 dígitos en vez de truncar el número).
 */
export async function generateTicketNumber(): Promise<string> {
  const rows = await sql`SELECT nextval('ticket_number_seq') AS n`;
  const n = Number(rows[0].n);
  return `#${String(n).padStart(4, "0")}`;
}
