/** División de cuenta: residuo a favor de la casa. Sin deps. */
export function computeSplit(totalPesos: number, parts: number): number[] {
  if (!Number.isFinite(totalPesos) || totalPesos < 0) {
    throw new Error("Total inválido");
  }
  if (!Number.isInteger(parts) || parts < 2) {
    throw new Error("parts debe ser un entero >= 2");
  }
  const total = Math.floor(totalPesos);
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, () => base);
}

export function houseRemainder(totalPesos: number, parts: number): number {
  const amounts = computeSplit(totalPesos, parts);
  const sum = amounts.reduce((a, b) => a + b, 0);
  return Math.floor(totalPesos) - sum;
}
