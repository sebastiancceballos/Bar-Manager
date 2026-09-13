/**
 * Filas devueltas por @neondatabase/serverless (neon tagged template)
 * se tipan de forma laxa. Usar DbRow en callbacks .map/.filter/.every
 * evita errores TS en Vercel del tipo:
 *   Property "id" is missing in type Record<string, any>
 */
export type DbRow = Record<string, any>;

export function asRows(data: unknown): DbRow[] {
  return Array.isArray(data) ? (data as DbRow[]) : [];
}
