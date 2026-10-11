import { getState } from "./state";

/**
 * Reemplazo de lib/db-pool.ts. connect() entrega un cliente con query()/release().
 * Solo un cliente a la vez (PGlite tiene una sola conexión): las transacciones
 * concurrentes se serializan, igual que si compitieran por la misma fila.
 */
async function acquire(): Promise<() => void> {
  const st = getState();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  const prev = st.lock;
  st.lock = prev.then(() => next);
  await prev;
  return release;
}

export function getPool() {
  return {
    async connect() {
      const releaseLock = await acquire();
      const { db, log } = getState();
      return {
        async query(text: string, params?: unknown[]) {
          log.push(text.replace(/\s+/g, " ").trim());
          const r = await db.query(text, params as any[]);
          return { rows: r.rows, rowCount: (r as any).affectedRows ?? r.rows.length };
        },
        release() {
          releaseLock();
        },
      };
    },
  };
}
