import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("computeOrderTotals (módulo real)", async () => {
  let computeOrderTotals;
  try {
    const mod = await import(pathToFileURL(join(root, "lib/pure/order-totals.ts")).href);
    computeOrderTotals = mod.computeOrderTotals;
  } catch (e) {
    it("requiere strip-types", () => assert.fail(String(e)));
    return;
  }

  it("sin IVA", () => {
    assert.equal(
      computeOrderTotals({ subtotal: 10000, discount: 0, tip: 0, taxRate: 0 }).finalTotal,
      10000
    );
  });

  it("con IVA 19% sobre neto", () => {
    const r = computeOrderTotals({
      subtotal: 10000,
      discount: 0,
      tip: 0,
      taxRate: 0.19,
    });
    assert.equal(r.tax, 1900);
    assert.equal(r.finalTotal, 11900);
  });

  it("descuento luego IVA", () => {
    const r = computeOrderTotals({
      subtotal: 10000,
      discount: 1000,
      tip: 500,
      taxRate: 0.19,
    });
    assert.equal(r.afterDiscount, 9000);
    assert.equal(r.tax, 1710);
    assert.equal(r.finalTotal, 11210);
  });
});
