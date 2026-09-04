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

/** Cutoff UTC para filtros sargables (sin envolver created_at en WHERE) */
export function reportCutoffIso(range: string, now = new Date()): string {
  const days = range === "year" ? 365 : range === "month" ? 30 : 7;
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}