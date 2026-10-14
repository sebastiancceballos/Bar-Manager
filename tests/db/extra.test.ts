import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setup, seed, q, call, route, openOrder, addItem, closeOrder,
  itemRows, stockOf, movements, type Seed,
} from "./harness";

const rejected = (status: number) => status >= 400 && status < 500;

describe("Casos adicionales y de regresión", () => {
  let s: Seed;
  before(setup);
  beforeEach(async () => {
    s = await seed();
  });

  it("el estado de cocina de un ítem sigue funcionando también tras cobrar", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 1, s.waiter);
    await closeOrder(orderId, s.cashier);
    const [row] = await itemRows(orderId);
    const items = await route("orders/[id]/items/[itemId]");
    const r = await call(items.PATCH, {
      method: "PATCH", token: s.cashier.token,
      params: { id: String(orderId), itemId: String(row.id) },
      body: { action: "set_status", status: "listo" },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await q(`SELECT status FROM order_items WHERE id=$1`, [row.id]))[0].status, "listo");
  });

  it("el estado de cocina no se puede cambiar en un ítem de OTRA orden", async () => {
    const mine = await openOrder(s, s.t1);
    const other = await openOrder(s, s.t2);
    await addItem(other.orderId, s.arepa, 1, s.waiter);
    const [victim] = await itemRows(other.orderId);
    const items = await route("orders/[id]/items/[itemId]");
    const r = await call(items.PATCH, {
      method: "PATCH", token: s.cashier.token,
      params: { id: String(mine.orderId), itemId: String(victim.id) },
      body: { action: "set_status", status: "listo" },
    });
    assert.ok(rejected(r.status), `llegó ${r.status}`);
  });

  it("se puede seguir agregando cuando la cuenta fue pedida (bill_requested)", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 1, s.waiter);
    await q(`UPDATE orders SET status='bill_requested' WHERE id=$1`, [orderId]);
    assert.equal((await addItem(orderId, s.arepa, 1, s.waiter)).status, 200);
    assert.equal((await closeOrder(orderId, s.cashier)).status, 200);
    assert.equal(await stockOf(s.arepa), 8);
  });

  it("agregar, restar y volver a agregar: se cobra lo que quedó en la orden", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 3, s.waiter);
    const [row] = await itemRows(orderId);
    const items = await route("orders/[id]/items/[itemId]");
    await call(items.PATCH, { method: "PATCH", token: s.waiter.token, params: { id: String(orderId), itemId: String(row.id) }, body: { action: "decrement" } });
    await addItem(orderId, s.arepa, 1, s.waiter);
    assert.equal(Number((await itemRows(orderId))[0].quantity), 3);
    assert.equal((await closeOrder(orderId, s.cashier)).status, 200);
    assert.equal(await stockOf(s.arepa), 7, "10 - 3");
  });

  it("orden heredada a la que se le agrega algo nuevo: solo se descuenta lo nuevo", async () => {
    const { orderId } = await openOrder(s, s.t1);
    // Sistema viejo: 2 arepas ya descontadas (stock 8).
    await q(`INSERT INTO order_items(order_id,product_id,quantity,price) VALUES($1,$2,2,5000)`, [orderId, s.arepa]);
    await q(`UPDATE products SET stock = 8 WHERE id=$1`, [s.arepa]);
    await q(`INSERT INTO stock_movements(product_id,quantity,type,reason,created_by) VALUES($1,2,'sale',$2,$3)`, [s.arepa, `Venta en mesa (Orden #${orderId})`, s.waiter.id]);
    // Sistema nuevo: se agrega 1 más y se cobra.
    assert.equal((await addItem(orderId, s.arepa, 1, s.waiter)).status, 200);
    assert.equal((await closeOrder(orderId, s.cashier)).status, 200);
    assert.equal(await stockOf(s.arepa), 7, "8 - 1 (solo la unidad nueva)");
  });

  it("orden heredada con ítems ya devueltos (restados) en el sistema viejo: no descuenta de más", async () => {
    const { orderId } = await openOrder(s, s.t1);
    // Viejo: se agregaron 3 (descontó 3) y luego se restó 1 (devolvió 1) => quedan 2, stock 9.
    await q(`INSERT INTO order_items(order_id,product_id,quantity,price) VALUES($1,$2,2,5000)`, [orderId, s.arepa]);
    await q(`UPDATE products SET stock = 9 WHERE id=$1`, [s.arepa]);
    await q(`INSERT INTO stock_movements(product_id,quantity,type,reason,created_by) VALUES($1,3,'sale',$2,$3)`, [s.arepa, `Venta en mesa (Orden #${orderId})`, s.waiter.id]);
    await q(`INSERT INTO stock_movements(product_id,quantity,type,reason,created_by) VALUES($1,1,'entry',$2,$3)`, [s.arepa, `Reducción de cantidad en Orden #${orderId}`, s.waiter.id]);
    assert.equal((await closeOrder(orderId, s.cashier)).status, 200);
    assert.equal(await stockOf(s.arepa), 9, "ya estaba descontado: nada más");
  });

  it("cancelar dos veces un pedido de autoservicio devuelve el stock una sola vez", async () => {
    const id = (await q(
      `INSERT INTO orders(table_id, waiter_id, status, total_amount, order_type, ticket_number)
       VALUES(NULL, NULL, 'PREPARING', 10000, 'self_service', 'A-7') RETURNING id`
    ))[0].id as number;
    await q(`INSERT INTO order_items(order_id,product_id,quantity,price) VALUES($1,$2,2,5000)`, [id, s.arepa]);
    await q(`UPDATE products SET stock = 8 WHERE id=$1`, [s.arepa]); // ya cobrado: stock descontado
    const status = await route("self-service/orders/[id]/status");
    const cancel = () => call(status.PATCH, { method: "PATCH", token: s.cashier.token, params: { id: String(id) }, body: { status: "CANCELLED" } });
    const [a, b] = await Promise.all([cancel(), cancel()]);
    assert.ok([a.status, b.status].includes(200), `${a.status}/${b.status}`);
    assert.equal(await stockOf(s.arepa), 10, `devuelto una sola vez (${a.status}/${b.status})`);
  });

  it("los errores salen en el idioma elegido (cookie bm_locale)", async () => {
    const { orderId } = await openOrder(s, s.t1);
    await addItem(orderId, s.arepa, 1, s.waiter);
    await closeOrder(orderId, s.cashier);
    const orders = await route("orders/[id]");
    const doClose = (locale: string) => call(orders.PUT, {
      method: "PUT", token: s.cashier.token, cookies: { bm_locale: locale },
      params: { id: String(orderId) }, body: { status: "paid", paymentMethod: "efectivo" },
    });
    const en = await doClose("en");
    const es = await doClose("es");
    assert.match(String(en.json?.error), /already been paid/i);
    assert.match(String(es.json?.error), /ya fue cobrada/i);
  });

  it("el aviso de stock sale en el idioma elegido", async () => {
    const a = await openOrder(s, s.t1);
    const b = await openOrder(s, s.t2);
    await addItem(a.orderId, s.gaseosa, 2, s.waiter);
    const items = await route("orders/[id]/items");
    const r = await call(items.POST, {
      method: "POST", token: s.waiter.token, cookies: { bm_locale: "en" },
      params: { id: String(b.orderId) }, body: { productId: s.gaseosa, quantity: 1 },
    });
    assert.match(String(r.json?.stockWarning?.message), /ordered across open tables/i);
  });
});
