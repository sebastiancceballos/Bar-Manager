import { cookies } from "next/headers";
import { sql } from "./db";
import type { UserRole } from "./auth";

export const ACTIVE_LOCATION_COOKIE = "active-location-id";

export type AccessibleLocation = {
  id: number;
  name: string;
  address: string | null;
  organization_id: number | null;
};

/**
 * Sucursales que el usuario puede operar.
 * - owner (superadmin): todas
 * - admin con organization_id: todas las de su org
 * - resto: solo users.location_id
 */
export async function getAccessibleLocations(
  userId: number,
  role: UserRole | string
): Promise<AccessibleLocation[]> {
  if (role === "owner") {
    const rows = await sql`
      SELECT id, name, address, organization_id
      FROM locations
      ORDER BY name
    `;
    return rows as AccessibleLocation[];
  }

  const userRows = await sql`
    SELECT location_id, organization_id FROM users WHERE id = ${userId} LIMIT 1
  `;
  const u = userRows[0];
  if (!u) return [];

  if (role === "admin" && u.organization_id) {
    const rows = await sql`
      SELECT id, name, address, organization_id
      FROM locations
      WHERE organization_id = ${u.organization_id}
      ORDER BY name
    `;
    return rows as AccessibleLocation[];
  }

  if (u.location_id) {
    const rows = await sql`
      SELECT id, name, address, organization_id
      FROM locations WHERE id = ${u.location_id} LIMIT 1
    `;
    return rows as AccessibleLocation[];
  }

  return [];
}

/** Valida que el usuario pueda usar ese location_id */
export async function userCanAccessLocation(
  userId: number,
  role: UserRole | string,
  locationId: number
): Promise<boolean> {
  const list = await getAccessibleLocations(userId, role);
  return list.some((l) => l.id === locationId);
}

/**
 * Location efectivo para APIs operativas:
 * 1) cookie active-location-id si es válida
 * 2) users.location_id
 * 3) primera sucursal accesible (admin multi-bar)
 */
export async function resolveLocationId(
  userId: number,
  role: UserRole | string
): Promise<number | null> {
  const accessible = await getAccessibleLocations(userId, role);
  if (accessible.length === 0) return null;

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value;
    if (raw) {
      const preferred = parseInt(raw, 10);
      if (!Number.isNaN(preferred) && accessible.some((l) => l.id === preferred)) {
        return preferred;
      }
    }
  } catch {
    // sin cookies (edge raro)
  }

  const userRows = await sql`
    SELECT location_id FROM users WHERE id = ${userId} LIMIT 1
  `;
  const home = userRows[0]?.location_id as number | null;
  if (home && accessible.some((l) => l.id === home)) return home;

  return accessible[0].id;
}

export async function getUserOrgId(userId: number): Promise<number | null> {
  const rows = await sql`
    SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows[0]?.organization_id ?? null;
}
