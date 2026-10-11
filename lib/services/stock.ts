import { InsufficientStockError } from "@/lib/errors";

/** Cliente mínimo (transacción abierta) que necesitan estas funciones. */
export type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

/**
 * Descuenta del inventario lo vendido en una orden. UNA sola vez, al cobrar.
 *
 * Compatibilidad con órdenes creadas antes de este cambio: el sistema anterior
 * ya descontaba el stock al agregar cada ítem (movimientos "Venta en mesa (Orden #N)"
 * y sus devoluciones). Por producto se calcula lo que ya se descontó y solo se
 * descuenta la diferencia, así el inventario de esas órdenes no se toca dos veces.
 *
 * Debe llamarse DENTRO de una transacción. Si falta stock lanza
 * InsufficientStockError y la transacción completa se revierte (el cobro se bloquea).
 */
export async function deductOrderStock(
  client: DbClient,
  opts: { orderId: number; userId: number; reason: string }
): Promise<void> {
  const { orderId, userId, reason } = opts;

  const items = (
    await client.query(
      `SELECT oi.product_id, SUM(oi.quantity)::int AS quantity, MAX(p.name) AS name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 AND oi.product_id IS NOT NULL
       GROUP BY oi.product_id
       ORDER BY oi.product_id`,
      [orderId]
    )
  ).rows;
  if (items.length === 0) return;

  const legacy = (
    await client.query(
      `SELECT product_id,
              SUM(CASE WHEN type = 'sale' THEN quantity ELSE -quantity END)::int AS net
       FROM stock_movements
       WHERE (type = 'sale'  AND reason = $1)
          OR (type = 'entry' AND reason IN ($2, $3))
       GROUP BY product_id`,
      [
        `Venta en mesa (Orden #${orderId})`,
        `Reducción de cantidad en Orden #${orderId}`,
        `Cancelación/Eliminación de item en Orden #${orderId}`,
      ]
    )
  ).rows;
  const alreadyDeducted = new Map<number, number>(
    legacy.map((r: any) => [Number(r.product_id), Math.max(0, Number(r.net) || 0)])
  );

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const toDeduct = qty - (alreadyDeducted.get(Number(item.product_id)) || 0);
    if (toDeduct <= 0) continue;

    const result = await client.query(
      `UPDATE products
       SET stock = COALESCE(stock, 0) - $1, updated_at = NOW()
       WHERE id = $2 AND COALESCE(stock, 0) >= $1
       RETURNING id`,
      [toDeduct, item.product_id]
    );
    if (result.rowCount === 0) {
      throw new InsufficientStockError(
        `Sin stock suficiente de "${item.name}". Repón inventario antes de cobrar.`,
        item.name,
        "apiInsufficientStockCharge",
        { name: item.name }
      );
    }
    await client.query(
      `INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
       VALUES ($1, $2, 'sale', $3, $4)`,
      [item.product_id, toDeduct, reason, userId]
    );
  }
}
