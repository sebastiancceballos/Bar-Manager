import { Pool } from "@neondatabase/serverless";

/**
 * Pool WebSocket para transacciones multi-statement (cobro/stock).
 * Solo usar en rutas Node que mutan dinero/inventario.
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL no está configurado");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
