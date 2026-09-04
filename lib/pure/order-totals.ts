/** Totales de cobro (subtotal, descuento, IVA, propina). Sin deps. */
export function computeOrderTotals(opts: {
  subtotal: number;
  discount: number;
  tip: number;
  taxRate: number;
}) {
  const subtotal = Math.max(0, Number(opts.subtotal) || 0);
  const discount = Math.max(0, Number(opts.discount) || 0);
  const tip = Math.max(0, Number(opts.tip) || 0);
  const taxRate = Math.max(0, Number(opts.taxRate) || 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = Math.round(afterDiscount * taxRate * 100) / 100;
  const finalTotal = afterDiscount + tax + tip;
  return { subtotal, discount, tip, tax, taxRate, afterDiscount, finalTotal };
}
