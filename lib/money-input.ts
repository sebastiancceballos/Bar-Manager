/** Helpers para ingresar montos en COP (sin decimales): 50000 → "50.000" */

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

/** Parsea input con o sin puntos/comas a número entero */
export function parseMoneyInput(value: string): number {
  const d = digitsOnly(value);
  if (!d) return 0;
  return parseInt(d, 10) || 0;
}

/** Formatea entero a miles estilo es-CO: 50000 → "50.000" */
export function formatMoneyInput(value: string | number): string {
  const n = typeof value === "number" ? value : parseMoneyInput(String(value));
  if (!n && String(value).replace(/\D/g, "") === "") return "";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Al escribir: solo dígitos, re-formatea con separador de miles */
export function onMoneyKeyInput(raw: string): string {
  const d = digitsOnly(raw);
  if (!d) return "";
  // Evitar ceros a la izquierda tipo 00050 → 50
  const n = parseInt(d, 10);
  if (Number.isNaN(n)) return "";
  return formatMoneyInput(n);
}

/** Denominaciones típicas COP para cobro rápido */
export const COP_DENOMS = [
  1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000,
] as const;
