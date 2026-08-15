import type { UserRole } from "./auth";

/**
 * Etiquetas de producto (UI). Los valores técnicos en DB no cambian:
 * owner = superadmin de plataforma, admin = dueño/admin del negocio.
 */
export const ROLE_LABELS: Record<UserRole | string, string> = {
  owner: "Superadmin",
  admin: "Administrador del negocio",
  cashier: "Cajero",
  waiter: "Mesero",
  kitchen: "Comandas",
};

export const ROLE_DESCRIPTIONS: Record<UserRole | string, string> = {
  owner: "Dueño de la plataforma: todos los negocios",
  admin: "Dueño o gerente del bar: su local (o locales)",
  cashier: "Mostrador: cobros, caja, mesas y comandas",
  waiter: "Salón: mesas y comandas (sin cobrar)",
  kitchen: "Preparación de pedidos (legado → Comandas)",
};

export function roleLabel(role: string | undefined | null): string {
  if (!role) return "";
  return ROLE_LABELS[role] || role;
}
