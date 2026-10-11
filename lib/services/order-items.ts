import { withTransaction } from "@/lib/withTransaction";
import { AppError, ConflictError } from "@/lib/errors";
import { apiTAsync } from "@/lib/api-i18n";
import type { DbClient } from "@/lib/services/stock";

/** Estados en los que una orden de mesa admite cambios en sus ítems. */
export const MODIFIABLE_ORDER_STATUSES = ["open", "bill_requested"];
export const MAX_ITEM_QUANTITY = 99;

export function parseQuantity(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= MAX_ITEM_QUANTITY
    ? raw
    : null;
}

/** Bloquea la fila de la orden (serializa cambios simultáneos) y valida su estado. */
async function lockOrder(client: DbClient, orderId: number, requireModifiable: boolean) {
  const { rows } = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
  const order = rows[0];
  if (!order) throw new AppError("Order not found", 404, "APP_ERROR", "apiOrderNotFound");
  if (requireModifiable && !MODIFIABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ConflictError("La orden no se puede modificar", "apiOrderNotModifiable");
  }
  return order;
}

async function recalcTotal(client: DbClient, orderId: number, userId: number) {
  await client.query(
    `UPDATE orders
     SET total_amount = COALESCE((SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1), 0),
         updated_at = NOW(), modified_by = $2
     WHERE id = $1`,
    [orderId, userId]
  );
}

async function loadOrderWithItems(client: DbClient, orderId: number) {
  const order = (await client.query(`SELECT * FROM orders WHERE id = $1`, [orderId])).rows[0];
  const items = (
    await client.query(
      `SELECT oi.*, p.name AS product_name, p.category
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1 ORDER BY oi.id`,
      [orderId]
    )
  ).rows;
  order.items = items.map((item: any) => ({
    ...item,
    product: { name: item.product_name, price: item.price, category: item.category },
  }));
  return order;
}

/**
 * Agrega un producto a una orden de mesa. NO toca el inventario (se descuenta al cobrar).
 * - Bloquea la orden: dos altas simultáneas no duplican filas.
 * - Rechaza productos de otra sede, órdenes ya cobradas y productos agotados (stock 0).
 * - Si lo pedido en mesas abiertas supera el stock, NO bloquea: devuelve un aviso.
 */
export async function addItemToOrder(opts: {
  orderId: number;
  productId: number;
  quantity: number;
  userId: number;
}) {
  const { orderId, productId, quantity, userId } = opts;
  let warning: { productId: number; productName: string; stock: number; reserved: number } | null = null;

  const order = await withTransaction(async (client) => {
    const ord = await lockOrder(client, orderId, true);

    const product = (await client.query(`SELECT * FROM products WHERE id = $1`, [productId])).rows[0];
    const orderLocation = ord.table_id
      ? (await client.query(`SELECT location_id FROM tables WHERE id = $1`, [ord.table_id])).rows[0]?.location_id
      : null;
    if (!product || (orderLocation != null && Number(product.location_id) !== Number(orderLocation))) {
      throw new AppError("Producto no encontrado", 404, "APP_ERROR", "apiProductNotFound");
    }

    const stock = Number(product.stock) || 0;
    if (stock <= 0) {
      throw new AppError("Producto agotado", 400, "OUT_OF_STOCK", "apiOutOfStock", {
        stock: 0,
        name: product.name,
      });
    }

    const existing = (
      await client.query(
        `SELECT id FROM order_items WHERE order_id = $1 AND product_id = $2 ORDER BY id LIMIT 1`,
        [orderId, productId]
      )
    ).rows[0];
    if (existing) {
      await client.query(`UPDATE order_items SET quantity = quantity + $1 WHERE id = $2`, [quantity, existing.id]);
    } else {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [orderId, productId, quantity, product.price]
      );
    }
    await recalcTotal(client, orderId, userId);

    const reserved = Number(
      (
        await client.query(
          `SELECT COALESCE(SUM(oi.quantity), 0)::int AS total
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE oi.product_id = $1 AND o.status IN ('open', 'bill_requested')`,
          [productId]
        )
      ).rows[0]?.total
    ) || 0;
    if (reserved > stock) {
      warning = { productId, productName: product.name, stock, reserved };
    }

    return loadOrderWithItems(client, orderId);
  });

  const stockWarning = warning
    ? {
        ...(warning as object),
        message: await apiTAsync("apiStockWarning", {
          reserved: (warning as any).reserved,
          name: (warning as any).productName,
          stock: (warning as any).stock,
        }),
      }
    : undefined;
  return { order, stockWarning };
}

/** Quita una unidad (decrement) o la línea completa (delete). Solo órdenes abiertas. */
export async function removeItemFromOrder(opts: {
  orderId: number;
  itemId: number;
  userId: number;
  mode: "decrement" | "delete";
}) {
  const { orderId, itemId, userId, mode } = opts;
  return withTransaction(async (client) => {
    await lockOrder(client, orderId, true);
    // El ítem debe pertenecer a ESTA orden.
    const item = (
      await client.query(`SELECT id, quantity FROM order_items WHERE id = $1 AND order_id = $2`, [itemId, orderId])
    ).rows[0];
    if (!item) throw new AppError("Item not found", 404, "APP_ERROR", "apiItemNotFound");

    if (mode === "decrement" && Number(item.quantity) > 1) {
      await client.query(`UPDATE order_items SET quantity = quantity - 1 WHERE id = $1`, [itemId]);
    } else {
      await client.query(`DELETE FROM order_items WHERE id = $1`, [itemId]);
    }
    await recalcTotal(client, orderId, userId);
    return loadOrderWithItems(client, orderId);
  });
}

/** Cambia el estado de cocina de un ítem (permitido también tras cobrar). */
export async function setItemKitchenStatus(opts: { orderId: number; itemId: number; status: string }) {
  const { orderId, itemId, status } = opts;
  return withTransaction(async (client) => {
    await lockOrder(client, orderId, false);
    const r = await client.query(
      `UPDATE order_items SET status = $1 WHERE id = $2 AND order_id = $3 RETURNING id`,
      [status, itemId, orderId]
    );
    if (!r.rowCount) throw new AppError("Item not found", 404, "APP_ERROR", "apiItemNotFound");
    return loadOrderWithItems(client, orderId);
  });
}
