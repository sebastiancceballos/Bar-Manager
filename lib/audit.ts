import { sql } from "./db";

interface AuditEntry {
  locationId?: number | null;
  userId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number | null;
  details?: string;
}

/**
 * Writes one row to audit_log. Never throws — a failure to log an audit
 * entry should never block the actual business operation.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_log (location_id, user_id, action, entity_type, entity_id, details)
      VALUES (${entry.locationId ?? null}, ${entry.userId ?? null}, ${entry.action}, ${entry.entityType ?? null}, ${entry.entityId ?? null}, ${entry.details ?? null})
    `;
  } catch (error) {
    console.error("Failed to write audit log entry:", error);
  }
}
