import { sql } from "./db";

/**
 * Returns the IANA timezone configured for a location (e.g. "America/Bogota").
 * Falls back to America/Bogota if the location has none set, since that's
 * where this product is currently deployed.
 */
export async function getLocationTimezone(locationId: number): Promise<string> {
  const rows = await sql`SELECT timezone FROM locations WHERE id = ${locationId} LIMIT 1`;
  return rows[0]?.timezone || "America/Bogota";
}
