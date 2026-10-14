import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setup, seed, q, call, route, openOrder, addItem, closeOrder,
  itemRows, stockOf, movements, type Seed,
} from "./harness";

const rejected = (status: number) => status >= 400 && status < 500;

describe("Agregar, restar y quitar ítems de una mesa", () => {
  let s: Seed;
  before(setup);
  beforeEach(async () => {
    s = await seed();
  });

  it("agregar el mismo producto dos veces suma en UNA fila y NO toca el stock", async () => {
    const { orderId } = await openOrder(s, s.t1);
    assert.equal((await addItem(orderId, s.arepa, 1, s.waiter)).status, 200);
    assert.equal((await addItem(orderId, s.arepa, 1, s.waiter)).status, 200);
    assert.deepEqual((await itemRows(orderId)).map((r) => Number(r.quantity)), [2]);
    assert.equal(await stockOf(s.arepa), 10, "el stock solo debe bajar al cobrar");
    assert.equal((await movements(s.arepa)).length, 0, "no debe haber movimientos de stock al agregar");
  });

  it("restar un ítem no toca el stock ni deja movimientos", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 1, s.waiter);
    await addItem(orderId, s.arepa, 1, s.waiter);
    const [row] = await itemRows(orderId);
    const items = await route("orders/[id]/items/[itemId]");
    const r = await call(items.PATCH, {
      method: "PATCH", token: s.waiter.token,
      params: { id: String(orderId), itemId: String(row.id) },
      body: { action: "decrement" },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual((await itemRows(orderId)).map((x) => Number(x.quantity)), [1]);
    assert.equal(await stockOf(s.arepa), 10);
    assert.equal((await movements(s.arepa)).length, 0);
  });

  it("eliminar un ítem no toca el stock ni deja movimientos", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 1, s.waiter);
    const [row] = await itemRows(orderId);
    const items = await route("orders/[id]/items/[itemId]");
    const r = await call(items.DELETE, {
      method: "DELETE", token: s.waiter.token,
      params: { id: String(orderId), itemId: String(row.id) },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await itemRows(orderId)).length, 0);
    assert.equal(await stockOf(s.arepa), 10);
    assert.equal((await movements(s.arepa)).length, 0);
  });

  it("un producto agotado (stock 0) no se puede agregar", async () => {
    const { orderId } = await openOrder(s, s.t1);
    const r = await addItem(orderId, s.cerveza, 1, s.waiter);
    assert.ok(rejected(r.status), `esperaba rechazo, llegó ${r.status}`);
    assert.equal((await itemRows(orderId)).length, 0);
  });

  it("al pedir más de lo que queda (sumando otras mesas abiertas) AVISA pero no bloquea", async () => {
    const a = await openOrder(s, s.t1);
    const b = await openOrder(s, s.t2);
    const r1 = await addItem(a.orderId, s.gaseosa, 2, s.waiter); // stock 2 → 2 pedidas: sin aviso
    assert.equal(r1.status, 200, JSON.stringify(r1.json));
    assert.ok(!r1.json?.stockWarning, "no debería avisar: 2 pedidas de 2");
    const r2 = await addItem(b.orderId, s.gaseosa, 1, s.waiter); // 3 pedidas de 2
    assert.equal(r2.status, 200, "debe permitir agregar (solo avisa)");
    assert.ok(r2.json?.stockWarning, "debe incluir stockWarning");
    assert.equal(Number(r2.json.stockWarning.stock), 2);
    assert.equal(Number(r2.json.stockWarning.reserved), 3);
  });

  it("dos altas simultáneas del mismo producto no duplican filas", async () => {
    const { orderId } = await openOrder(s, s.t1);
    const [r1, r2] = await Promise.all([
      addItem(orderId, s.arepa, 1, s.waiter),
      addItem(orderId, s.arepa, 1, s.waiter),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    const rows = await itemRows(orderId);
    assert.equal(rows.length, 1, `filas: ${JSON.stringify(rows)}`);
    assert.equal(Number(rows[0].quantity), 2);
  });

  for (const bad of [-3, 0, 1.5, "abc", 100, 1e9]) {
    it(`cantidad inválida (${JSON.stringify(bad)}) se rechaza y no deja rastro`, async () => {
      await q(`UPDATE products SET stock = 2000000000 WHERE id=$1`, [s.arepa]); // que el stock no sea la excusa
      const { orderId } = await openOrder(s, s.t1);
      const r = await addItem(orderId, s.arepa, bad as number, s.waiter);
      assert.ok(rejected(r.status), `esperaba rechazo, llegó ${r.status}`);
      assert.equal((await itemRows(orderId)).length, 0);
      assert.equal(await stockOf(s.arepa), 2000000000);
    });
  }

  it("un producto de otra sede se rechaza", async () => {
    const { orderId } = await openOrder(s, s.t1);
    const r = await addItem(orderId, s.foreign, 1, s.waiter);
    assert.ok(rejected(r.status), `esperaba rechazo, llegó ${r.status}`);
    assert.equal((await itemRows(orderId)).length, 0);
  });

  it("no se puede borrar un ítem de OTRA orden usando el id de una propia", async () => {
    const mine = await openOrder(s, s.t1);
    const other = await openOrder(s, s.t2);
    await addItem(other.orderId, s.arepa, 1, s.waiter);
    const [victim] = await itemRows(other.orderId);
    const items = await route("orders/[id]/items/[itemId]");
    const r = await call(items.DELETE, {
      method: "DELETE", token: s.waiter.token,
      params: { id: String(mine.orderId), itemId: String(victim.id) },
    });
    assert.ok(rejected(r.status), `esperaba rechazo, llegó ${r.status}`);
    assert.equal((await itemRows(other.orderId)).length, 1, "el ítem ajeno debe seguir ahí");
  });

  it("no se puede restar un ítem de OTRA orden usando el id de una propia", async () => {
    const mine = await openOrder(s, s.t1);
    const other = await openOrder(s, s.t2);
    await addItem(other.orderId, s.arepa, 2, s.waiter);
    const [victim] = await itemRows(other.orderId);
    const items = await route("orders/[id]/items/[itemId]");
    const r = await call(items.PATCH, {
      method: "PATCH", token: s.waiter.token,
      params: { id: String(mine.orderId), itemId: String(victim.id) },
      body: { action: "decrement" },
    });
    assert.ok(rejected(r.status), `esperaba rechazo, llegó ${r.status}`);
    assert.equal(Number((await itemRows(other.orderId))[0].quantity), 2);
  });

  it("una orden ya cobrada no admite agregar, restar ni eliminar", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 2, s.waiter);
    assert.equal((await closeOrder(orderId, s.cashier)).status, 200);
    const [row] = await itemRows(orderId);
    const items = await route("orders/[id]/items/[itemId]");

    const add = await addItem(orderId, s.arepa, 1, s.waiter);
    const dec = await call(items.PATCH, {
      method: "PATCH", token: s.waiter.token,
      params: { id: String(orderId), itemId: String(row.id) }, body: { action: "decrement" },
    });
    const del = await call(items.DELETE, {
      method: "DELETE", token: s.waiter.token,
      params: { id: String(orderId), itemId: String(row.id) },
    });
    assert.ok(rejected(add.status), `agregar: ${add.status}`);
    assert.ok(rejected(dec.status), `restar: ${dec.status}`);
    assert.ok(rejected(del.status), `eliminar: ${del.status}`);
    assert.deepEqual((await itemRows(orderId)).map((x) => Number(x.quantity)), [2]);
  });
});
