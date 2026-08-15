import type { UserRole } from "./auth";

/**
 * Fuente única de permisos operativos del bar.
 * Mantener alineado con Navigation, OrderModal y APIs.
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

/** Configurar productos, usuarios, reportes del bar */
export function canManageBusiness(role: string | undefined): boolean {
  return role === "admin" || role === "owner";
}

export type NavLinkDef = {
  href: string;
  label: string;
  /** roles que ven este link (owner plataforma tiene set propio) */
  roles?: UserRole[];
};

/** Links operativos por rol (sin panel plataforma) */
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
