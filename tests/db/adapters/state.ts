import { PGlite, types } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Estado compartido de la base en memoria. Vive en globalThis para que
 * los adaptadores y las pruebas vean SIEMPRE la misma instancia.
 */
const KEY = Symbol.for("barmanager.testdb");

export type TestState = {
  db: PGlite;
  /** cola para serializar transacciones (PGlite tiene una sola conexión) */
  lock: Promise<void>;
  /** todas las sentencias ejecutadas (útil para depurar) */
  log: string[];
};

export function getState(): TestState {
  const st = (globalThis as any)[KEY] as TestState | undefined;
  if (!st) throw new Error("Base de pruebas no inicializada: llama a createTestDb() primero");
  return st;
}

// Mismos scripts y orden que se usó para validar el esquema real.
const SCHEMA_ORDER = [
  "01_create_schema_clean",
  "05_add_modified_by",
  "06_consolidate_hidden_migrations",
  "07_add_comanda_status",
  "08_operational_features",
  "09_self_service",
  "11_organizations",
  "13_perf_indexes",
  "14_must_change_password",
  "15_order_splits",
  "16_locations_active_and_inventory",
  "17_tables_unique_number",
];

export async function createTestDb(projectRoot: string): Promise<TestState> {
  const existing = (globalThis as any)[KEY] as TestState | undefined;
  if (existing) return existing;
  // int8 como string, igual que el driver de Neon
  const db = new PGlite({ parsers: { [types.INT8]: (v: string) => v } });
  for (const name of SCHEMA_ORDER) {
    const file = join(projectRoot, "scripts", `${name}.sql`);
    if (!existsSync(file)) continue;
    // pgcrypto no existe en PGlite; gen_random_uuid() ya viene en Postgres moderno
    const sqlText = readFileSync(file, "utf8").replace(/CREATE EXTENSION[^;]*pgcrypto[^;]*;/gi, "");
    await db.exec(sqlText);
  }
  const st: TestState = { db, lock: Promise.resolve(), log: [] };
  (globalThis as any)[KEY] = st;
  return st;
}

/** Vacía todas las tablas (rápido) y reinicia los ids. */
export async function resetDb(): Promise<void> {
  const { db } = getState();
  await db.exec(
    `TRUNCATE order_splits, order_items, stock_movements, audit_log, orders, tables, products, cash_sessions, reservations, shifts, daily_income, users, locations, organizations RESTART IDENTITY CASCADE`
  );
}
