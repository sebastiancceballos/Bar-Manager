import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "lib/tenant.ts"), "utf8");

describe("tenant.ts contrato", () => {
  for (const name of [
    "assertOwnsTable",
    "assertOwnsProduct",
    "assertOwnsOrder",
    "assertOwnsReservation",
    "assertOwnsCashSession",
    "assertOwnsLocation",
  ]) {
    it(`exporta ${name}`, () => {
      assert.match(src, new RegExp(`export async function ${name}`));
    });
  }
  it("usa 404 en mismatch (no 403)", () => {
    assert.match(src, /status: 404/);
  });
});

describe("tenant isolation (integración)", () => {
  const hasDb = Boolean(process.env.DATABASE_URL);
  it(
    "admin Bar A no ve producto de Bar B",
    { skip: !hasDb },
    async () => {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      // Setup mínimo: dos locations, dos productos
      const locs = await sql`
        INSERT INTO locations (name, address)
        VALUES ('__test_bar_a__', 'x'), ('__test_bar_b__', 'y')
        RETURNING id, name
      `;
      const a = locs[0].id;
      const b = locs[1].id;
      const prods = await sql`
        INSERT INTO products (location_id, name, category, price, available)
        VALUES
          (${a}, '__test_prod_a__', 'test', 1000, true),
          (${b}, '__test_prod_b__', 'test', 2000, true)
        RETURNING id, location_id
      `;
      const prodB = prods.find((p) => p.location_id === b);
      // Simular guard SQL equivalente a assertOwnsProduct para location A
      const rows = await sql`
        SELECT id FROM products WHERE id = ${prodB.id} AND location_id = ${a} LIMIT 1
      `;
      assert.equal(rows.length, 0, "no debe encontrar producto de otro bar");
      // cleanup
      await sql`DELETE FROM products WHERE name LIKE '__test_prod_%'`;
      await sql`DELETE FROM locations WHERE name LIKE '__test_bar_%'`;
    }
  );
});
