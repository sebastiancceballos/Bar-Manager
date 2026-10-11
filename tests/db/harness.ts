import { NextRequest } from "next/server";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { createTestDb, resetDb, getState } from "./adapters/state";
import { requestContext } from "./adapters/next-headers";
import { signToken } from "@/lib/auth";

export const ROOT = process.env.PROJECT_ROOT as string;
export { getState };

export async function setup() {
  await createTestDb(ROOT);
}

/** Consulta directa a la base de pruebas. */
export async function q(text: string, params: unknown[] = []): Promise<any[]> {
  const r = await getState().db.query(text, params as any[]);
  return r.rows;
}

export type Seed = Awaited<ReturnType<typeof seed>>;

/** Base limpia con: 1 org, 2 sedes, usuarios por rol, mesas y productos. */
export async function seed() {
  await resetDb();
  const org = (await q(`INSERT INTO organizations(name,status) VALUES('Org Demo','active') RETURNING id`))[0].id;
  const mkLoc = async (name: string) =>
    (await q(
      `INSERT INTO locations(name,address,organization_id,tax_rate,timezone,active,self_service_enabled)
       VALUES($1,'Calle 1',$2,0,'America/Bogota',true,true) RETURNING id`,
      [name, org]
    ))[0].id as number;
  const loc = await mkLoc("Bar A");
  const otherLoc = await mkLoc("Bar B");

  const mkUser = async (role: string, location: number) => {
    const email = `${role}${location}@test.com`;
    const id = (await q(
      `INSERT INTO users(email,password_hash,name,role,location_id,organization_id)
       VALUES($1,'x',$2,$3,$4,$5) RETURNING id`,
      [email, role, role, location, org]
    ))[0].id as number;
    const token = await signToken({ id, email, role });
    return { id, email, role, token };
  };
  const waiter = await mkUser("waiter", loc);
  const cashier = await mkUser("cashier", loc);
  const admin = await mkUser("admin", loc);
  const otherCashier = await mkUser("cashier", otherLoc);

  const mkTable = async (n: string, location = loc) =>
    (await q(
      `INSERT INTO tables(location_id,table_number,capacity,status) VALUES($1,$2,4,'available') RETURNING id`,
      [location, n]
    ))[0].id as number;
  const t1 = await mkTable("1");
  const t2 = await mkTable("2");
  const t3 = await mkTable("3");

  const mkProduct = async (name: string, price: number, stock: number, location = loc) =>
    (await q(
      `INSERT INTO products(location_id,name,category,price,stock,available) VALUES($1,$2,'Comida',$3,$4,true) RETURNING id`,
      [location, name, price, stock]
    ))[0].id as number;
  const arepa = await mkProduct("Arepa", 5000, 10);
  const gaseosa = await mkProduct("Gaseosa", 3000, 2);
  const cerveza = await mkProduct("Cerveza", 6000, 0);
  const foreign = await mkProduct("Producto de Bar B", 1000, 50, otherLoc);

  return { org, loc, otherLoc, waiter, cashier, admin, otherCashier, t1, t2, t3, arepa, gaseosa, cerveza, foreign };
}

const routeCache = new Map<string, any>();
/** Carga el handler REAL de una ruta, p. ej. route("orders/[id]/items"). */
export async function route(rel: string) {
  if (!routeCache.has(rel)) {
    const file = join(ROOT, "app", "api", rel, "route.ts");
    routeCache.set(rel, await import(pathToFileURL(file).href));
  }
  return routeCache.get(rel);
}

type CallOpts = {
  method?: string;
  url?: string;
  body?: unknown;
  token?: string;
  cookies?: Record<string, string>;
  params?: Record<string, string>;
};

/** Ejecuta un handler de ruta como lo haría Next: con cookies y sin red. */
export async function call(handler: (...a: any[]) => Promise<Response>, opts: CallOpts = {}) {
  const { method = "GET", url = "http://localhost/api/test", body, token, cookies = {}, params } = opts;
  const jar = new Map<string, string>(Object.entries(cookies));
  if (token) jar.set("auth-token", token);
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  const req = new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await requestContext.run({ cookies: jar }, () =>
    handler(req, params ? { params: Promise.resolve(params) } : undefined)
  );
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, json };
}

// ---- atajos de dominio -------------------------------------------------
export async function openOrder(s: Seed, tableId: number, user = s.waiter) {
  const orders = await route("orders");
  const r = await call(orders.POST, { method: "POST", token: user.token, body: { tableId } });
  return { ...r, orderId: r.json?.order?.id as number };
}

export async function addItem(orderId: number, productId: number, quantity: number, user: { token: string }) {
  const items = await route("orders/[id]/items");
  return call(items.POST, {
    method: "POST",
    token: user.token,
    params: { id: String(orderId) },
    body: { productId, quantity },
  });
}

export async function closeOrder(orderId: number, user: { token: string }, extra: Record<string, unknown> = {}) {
  const r = await route("orders/[id]");
  return call(r.PUT, {
    method: "PUT",
    token: user.token,
    params: { id: String(orderId) },
    body: { status: "paid", paymentMethod: "efectivo", ...extra },
  });
}

export const stockOf = async (productId: number): Promise<number> =>
  Number((await q(`SELECT stock FROM products WHERE id=$1`, [productId]))[0].stock);

export const itemRows = (orderId: number) =>
  q(`SELECT id, product_id, quantity FROM order_items WHERE order_id=$1 ORDER BY id`, [orderId]);

export const movements = (productId: number) =>
  q(`SELECT type, quantity, reason FROM stock_movements WHERE product_id=$1 ORDER BY id`, [productId]);
