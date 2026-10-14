import { getState } from "./state";

/**
 * Reemplazo de lib/db.ts (neon HTTP) para las pruebas.
 * Misma forma de uso: sql`SELECT ... ${valor}` -> arreglo de filas.
 */
export const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const { db, log } = getState();
  let text = strings[0];
  values.forEach((_, i) => {
    text += `$${i + 1}` + strings[i + 1];
  });
  log.push(text.replace(/\s+/g, " ").trim());
  const res = await db.query(text, values as any[]);
  return res.rows;
}) as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;
