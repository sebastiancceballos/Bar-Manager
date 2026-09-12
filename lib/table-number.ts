/** Normaliza número de mesa: trim, sin ceros a la izquierda si es numérico */
export function normalizeTableNumber(raw: string | number): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1) return "";
    return String(n);
  }
  return s;
}

export function isPositiveIntString(s: string): boolean {
  return /^\d+$/.test(s) && parseInt(s, 10) >= 1;
}

/** Orden natural: numéricas primero 1,2,10…; texto al final */
export function compareTableNumbers(a: string, b: string): number {
  const na = /^\d+$/.test(a) ? parseInt(a, 10) : null;
  const nb = /^\d+$/.test(b) ? parseInt(b, 10) : null;
  if (na != null && nb != null) return na - nb;
  if (na != null) return -1;
  if (nb != null) return 1;
  return a.localeCompare(b, "es", { sensitivity: "base" });
}
