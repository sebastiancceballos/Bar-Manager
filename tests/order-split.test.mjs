import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadPure() {
  // Node 22+: strip types from .ts
  const url = pathToFileURL(join(root, "lib/pure/order-split.ts")).href;
  return import(url);
}

describe("computeSplit (módulo real)", async () => {
  let computeSplit, houseRemainder;
  try {
    const mod = await loadPure();
    computeSplit = mod.computeSplit;
    houseRemainder = mod.houseRemainder;
  } catch (e) {
    // Fallback si el runtime no soporta strip-types: fallar explícito
    it("requiere Node con --experimental-strip-types o tsx", () => {
      assert.fail(String(e));
    });
    return;
  }

  it("10000 / 3 → 3333×3, residuo 1 casa", () => {
    assert.deepEqual(computeSplit(10000, 3), [3333, 3333, 3333]);
    assert.equal(houseRemainder(10000, 3), 1);
  });

  it("10000 / 2 exacto", () => {
    assert.deepEqual(computeSplit(10000, 2), [5000, 5000]);
    assert.equal(houseRemainder(10000, 2), 0);
  });
});
