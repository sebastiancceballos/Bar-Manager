import { sql } from "@/lib/db";

/** Resuelve location_ids para reportes de una org o un solo local */
export async function resolveReportLocationIds(
  locId: number,
  scope: "location" | "organization"
): Promise<number[]> {
  if (scope !== "organization") return [locId];
  const orgRow = await sql`
    SELECT organization_id FROM locations WHERE id = ${locId} LIMIT 1
  `;
  const orgId = orgRow[0]?.organization_id;
  if (!orgId) return [locId];
  const locs = await sql`SELECT id FROM locations WHERE organization_id = ${orgId}`;
  return locs.map((r: any) => Number(r.id));
}

/**
 * Inicio del rango en ISO (UTC).
 * - day: medianoche de HOY en la timezone del bar
 * - week/month/year: ahora menos N días
 */
export async function reportCutoffIso(
  range: string,
  tz: string = "America/Bogota"
): Promise<string> {
  if (range === "day") {
    const rows = await sql`
      SELECT (
        ((CURRENT_TIMESTAMP AT TIME ZONE ${tz})::date)::timestamp
        AT TIME ZONE ${tz}
      ) AS start
    `;
    const start = rows[0]?.start;
    return start ? new Date(start).toISOString() : new Date().toISOString();
  }

  const days = range === "year" ? 365 : range === "month" ? 30 : 7;
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

/** @deprecated usar reportCutoffIso async con tz */
export function reportCutoffIsoSync(range: string, now = new Date()): string {
  if (range === "day") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = range === "year" ? 365 : range === "month" ? 30 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
