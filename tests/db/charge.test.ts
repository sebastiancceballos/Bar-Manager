import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setup, seed, q, call, route, openOrder, addItem, closeOrder,
  stockOf, movements, type Seed,
} from "./harness";

const rejected = (status: number) => status >= 400 && status < 500;
const orderStatus = async (id: number) => (await q(`SELECT status FROM orders WHERE id=$1`, [id]))[0].status;

describe("Cobro de mesas", () => {
  let s: Seed;
  before(setup);
  beforeEach(async () => {
    s = await seed();
  });

  it("cobrar descuenta el stock UNA sola vez", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 2, s.waiter);
    const r = await closeOrder(orderId, s.cashier);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(await orderStatus(orderId), "paid");
    assert.equal(await stockOf(s.arepa), 8, "10 - 2 vendidas");
    const sales = (await movements(s.arepa)).filter((m) => m.type === "sale");
    assert.equal(sales.length, 1, `movimientos: ${JSON.stringify(sales)}`);
    assert.equal(Number(sales[0].quantity), 2);
  });

  it("cobrar la misma orden dos veces: la segunda se rechaza y el stock no vuelve a bajar", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 2, s.waiter);
    assert.equal((await closeOrder(orderId, s.cashier)).status, 200);
    const stockAfterFirst = await stockOf(s.arepa);
    const second = await closeOrder(orderId, s.cashier);
    assert.ok(rejected(second.status), `la segunda debía rechazarse, llegó ${second.status}`);
    assert.equal(await stockOf(s.arepa), stockAfterFirst);
    assert.equal((await movements(s.arepa)).filter((m) => m.type === "sale").length, 1);
  });

  it("dos cobros simultáneos: solo uno se aplica", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 2, s.waiter);
    const [a, b] = await Promise.all([closeOrder(orderId, s.cashier), closeOrder(orderId, s.cashier)]);
    const ok = [a, b].filter((r) => r.status === 200).length;
    assert.equal(ok, 1, `éxitos: ${a.status}, ${b.status}`);
    assert.equal(await stockOf(s.arepa), 8);
  });

  it("sin stock suficiente se BLOQUEA el cobro: la orden sigue abierta y nada cambia", async () => {
    const { orderId } = await openOrder(s, s.t1);
    // gaseosa tiene stock 2; se piden 3 (agregar solo avisa)
    assert.equal((await addItem(orderId, s.gaseosa, 3, s.waiter)).status, 200);
    const r = await closeOrder(orderId, s.cashier);
    assert.ok(rejected(r.status), `esperaba bloqueo, llegó ${r.status}`);
    assert.match(String(r.json?.error || ""), /stock/i);
    assert.equal(await orderStatus(orderId), "open");
    assert.equal(await stockOf(s.gaseosa), 2);
    assert.equal((await movements(s.gaseosa)).length, 0);
  });

  it("una orden HEREDADA (stock ya descontado al agregar) no vuelve a descontar al cobrar", async () => {
    const { orderId } = await openOrder(s, s.t1);
    // Simula una orden creada con el sistema viejo: 2 arepas, stock ya descontado al agregar.
    await q(`INSERT INTO order_items(order_id,product_id,quantity,price) VALUES($1,$2,2,5000)`, [orderId, s.arepa]);
    await q(`UPDATE products SET stock = 8 WHERE id=$1`, [s.arepa]);
    await q(
      `INSERT INTO stock_movements(product_id,quantity,type,reason,created_by) VALUES($1,2,'sale',$2,$3)`,
      [s.arepa, `Venta en mesa (Orden #${orderId})`, s.waiter.id]
    );
    const r = await closeOrder(orderId, s.cashier);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(await stockOf(s.arepa), 8, "no debe descontar otra vez");
  });

  it("un mesero no puede cobrar", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 1, s.waiter);
    const r = await closeOrder(orderId, s.waiter);
    assert.ok(rejected(r.status), `llegó ${r.status}`);
    assert.equal(await orderStatus(orderId), "open");
  });

  it("cuenta dividida: pagar la última parte dos veces a la vez descuenta el stock una sola vez", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 2, s.waiter);
    const split = await route("orders/[id]/split");
    const created = await call(split.POST, {
      method: "POST", token: s.cashier.token, params: { id: String(orderId) }, body: { parts: 2 },
    });
    assert.ok([200, 201].includes(created.status), `crear partes: ${created.status} ${JSON.stringify(created.json)}`);
    const pay = await route("orders/[id]/split/[splitIndex]");
    const payPart = (i: number) =>
      call(pay.PATCH, {
        method: "PATCH", token: s.cashier.token,
        params: { id: String(orderId), splitIndex: String(i) }, body: { paymentMethod: "efectivo" },
      });
    const first = await payPart(1);
    assert.equal(first.status, 200, JSON.stringify(first.json));
    await Promise.all([payPart(2), payPart(2)]);
    assert.equal(await orderStatus(orderId), "paid");
    assert.equal(await stockOf(s.arepa), 8, "10 - 2, una sola vez");
    assert.equal((await movements(s.arepa)).filter((m) => m.type === "sale").length, 1);
  });
});

describe("Cobro de autoservicio", () => {
  let s: Seed;
  before(setup);
  beforeEach(async () => {
    s = await seed();
  });

  it("dos cobros simultáneos del mismo pedido descuentan el stock una sola vez", async () => {
    const id = (await q(
      `INSERT INTO orders(table_id, waiter_id, status, total_amount, order_type, ticket_number)
       VALUES(NULL, NULL, 'PENDING_PAYMENT', 10000, 'self_service', 'A-1') RETURNING id`
    ))[0].id as number;
    await q(`INSERT INTO order_items(order_id,product_id,quantity,price) VALUES($1,$2,2,5000)`, [id, s.arepa]);
    const status = await route("self-service/orders/[id]/status");
    const pay = () =>
      call(status.PATCH, {
        method: "PATCH", token: s.cashier.token, params: { id: String(id) },
        body: { status: "PAID", paymentMethod: "efectivo" },
      });
    const [a, b] = await Promise.all([pay(), pay()]);
    assert.ok([a.status, b.status].includes(200), `ninguno tuvo éxito: ${a.status}/${b.status} ${JSON.stringify(a.json)}`);
    assert.equal(await stockOf(s.arepa), 8, `stock tras dos cobros simultáneos (${a.status}/${b.status})`);
  });
});
