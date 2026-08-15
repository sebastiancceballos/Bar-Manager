import type { UserRole } from "./auth";

/**
 * Fuente única de permisos operativos del bar (FASE B).
 * Navigation, middleware y APIs deben usar estas funciones.
 */

export function isPlatformOwner(role: string | undefined): boolean {
  return role === "owner";
}

export function isBusinessAdmin(role: string | undefined): boolean {
  return role === "admin" || role === "owner";
}

export function isCashier(role: string | undefined): boolean {
  return role === "cashier";
}

export function isWaiter(role: string | undefined): boolean {
  return role === "waiter";
}

/** Cobrar mesa o autoservicio, cerrar cuenta */
export function canCharge(role: string | undefined): boolean {
  return role === "admin" || role === "owner" || role === "cashier";
}

/** Pedir cuenta / tomar pedidos de mesa */
export function canTakeTableOrders(role: string | undefined): boolean {
  return (
    role === "admin" ||
    role === "owner" ||
    role === "cashier" ||
    role === "waiter"
  );
}

/** Marcar cuenta pedida */
export function canRequestBill(role: string | undefined): boolean {
  return canTakeTableOrders(role);
}

/** Panel de comandas / marcar listo */
export function canUseComandas(role: string | undefined): boolean {
  return (
    role === "admin" ||
    role === "owner" ||
    role === "cashier" ||
    role === "waiter" ||
    role === "kitchen"
  );
}

/** Abrir/cerrar turno de caja */
export function canManageCashSession(role: string | undefined): boolean {
  return role === "admin" || role === "owner" || role === "cashier";
}

/** Pedidos autoservicio (cola de caja) */
export function canAccessSelfServiceQueue(role: string | undefined): boolean {
  return canCharge(role);
}

/** Configurar productos, usuarios, reportes del bar */
export function canManageBusiness(role: string | undefined): boolean {
  return role === "admin" || role === "owner";
}

/** Reservas */
export function canAccessReservations(role: string | undefined): boolean {
  return (
    role === "admin" ||
    role === "owner" ||
    role === "waiter"
  );
}

/**
 * Prefijos de dashboard y roles permitidos (middleware).
 * Orden: más específico primero no hace falta; se usa startsWith.
 */
export const DASHBOARD_ROUTE_ROLES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/dashboard/owner", roles: ["owner"] },
  { prefix: "/dashboard/bars", roles: ["owner"] },
  { prefix: "/dashboard/users", roles: ["owner", "admin"] },
  { prefix: "/dashboard/products", roles: ["owner", "admin"] },
  { prefix: "/dashboard/reports", roles: ["owner", "admin"] },
  { prefix: "/dashboard/auditoria", roles: ["owner", "admin"] },
  { prefix: "/dashboard/orders", roles: ["owner", "admin", "cashier"] },
  { prefix: "/dashboard/caja", roles: ["owner", "admin", "cashier"] },
  { prefix: "/dashboard/tables", roles: ["owner", "admin", "cashier", "waiter"] },
  { prefix: "/dashboard/comandas", roles: ["owner", "admin", "cashier", "waiter", "kitchen"] },
  { prefix: "/dashboard/kitchen", roles: ["owner", "admin", "cashier", "waiter", "kitchen"] },
  { prefix: "/dashboard/reservas", roles: ["owner", "admin", "waiter"] },
  { prefix: "/dashboard/turno", roles: ["owner", "admin", "cashier", "waiter", "kitchen"] },
  // /dashboard home: todos autenticados con rol de staff
  { prefix: "/dashboard", roles: ["owner", "admin", "cashier", "waiter", "kitchen"] },
];

/** ¿Puede el rol entrar a este path de dashboard? */
export function canAccessDashboardPath(
  role: string | undefined,
  pathname: string
): boolean {
  if (!role) return false;
  // Match longest prefix first
  const sorted = [...DASHBOARD_ROUTE_ROLES].sort(
    (a, b) => b.prefix.length - a.prefix.length
  );
  for (const rule of sorted) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
      return rule.roles.includes(role as UserRole);
    }
  }
  return false;
}

/** Links operativos por rol (nav) */
export function staffNavHrefs(role: UserRole | string): string[] {
  switch (role) {
    case "admin":
      return [
        "/dashboard",
        "/dashboard/products",
        "/dashboard/tables",
        "/dashboard/comandas",
        "/dashboard/caja",
        "/dashboard/orders",
        "/dashboard/reservas",
        "/dashboard/reports",
        "/dashboard/auditoria",
        "/dashboard/turno",
        "/dashboard/users",
      ];
    case "cashier":
      return [
        "/dashboard/tables",
        "/dashboard/comandas",
        "/dashboard/orders",
        "/dashboard/caja",
        "/dashboard/turno",
      ];
    case "waiter":
      return [
        "/dashboard/tables",
        "/dashboard/comandas",
        "/dashboard/reservas",
        "/dashboard/turno",
      ];
    case "kitchen":
      return ["/dashboard/comandas", "/dashboard/turno"];
    case "owner":
      return ["/dashboard/owner", "/dashboard/bars", "/dashboard/users"];
    default:
      return ["/dashboard/turno"];
  }
}
