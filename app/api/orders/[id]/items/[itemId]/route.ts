import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsOrder } from "@/lib/tenant";
import { sql } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, itemId } = await params;
    const orderId = parseInt(id, 10);
    const orderGuard = await assertOwnsOrder(orderId, user);
    if (orderGuard.error) return orderGuard.error;

    // Obtener detalles antes de borrar para devolver al stock
    const itemRows = await sql`SELECT product_id, quantity FROM order_items WHERE id = ${parseInt(itemId)}`;
    const itemToRestore = itemRows[0];

    // Delete item
    await sql`DELETE FROM order_items WHERE id = ${parseInt(itemId)}`;

    if (itemToRestore) {
      // Restaurar stock
      await sql`
        UPDATE products 
        SET stock = COALESCE(stock, 0) + ${itemToRestore.quantity}
        WHERE id = ${itemToRestore.product_id}
      `;

      // Registrar ajuste
      const reason = `Cancelación/Eliminación de item en Orden #${id}`;
      await sql`
        INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
        VALUES (${itemToRestore.product_id}, ${itemToRestore.quantity}, 'entry', ${reason}, ${user.id})
      `;
    }

    // Update order total
    const totalResult = await sql`
      SELECT COALESCE(SUM(price * quantity), 0) as total 
      FROM order_items 
      WHERE order_id = ${parseInt(id)}
    `;
    const total = parseFloat(totalResult[0]?.total || 0);

    await sql`
      UPDATE orders 
      SET total_amount = ${total}, updated_at = NOW()
      WHERE id = ${parseInt(id)}
    `;

    // Get updated order with items
    const orders = await sql`SELECT * FROM orders WHERE id = ${parseInt(id)}`;
    const order = orders[0];

    const items = await sql`
      SELECT oi.*, p.name as product_name, p.category
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${parseInt(id)}
    `;
    order.items = items.map(item => ({
      ...item,
      product: { name: item.product_name, price: item.price, category: item.category }
    }));

    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Delete item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, itemId } = await params;
    const orderId = parseInt(id, 10);
    const orderGuard = await assertOwnsOrder(orderId, user);
    if (orderGuard.error) return orderGuard.error;
    const { action, status } = await request.json();

    if (action !== "decrement" && action !== "set_status") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "set_status") {
      const allowedStatuses = ["pendiente", "preparando", "listo", "entregado"];
      if (!status || !allowedStatuses.includes(status)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }

      const itemRows = await sql`SELECT id FROM order_items WHERE id = ${parseInt(itemId)}`;
      if (itemRows.length === 0) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      await sql`UPDATE order_items SET status = ${status} WHERE id = ${parseInt(itemId)}`;

      const orders = await sql`SELECT * FROM orders WHERE id = ${parseInt(id)}`;
      const order = orders[0];

      const items = await sql`
        SELECT oi.*, p.name as product_name, p.category
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${parseInt(id)}
      `;
      order.items = items.map(i => ({
        ...i,
        product: { name: i.product_name, price: i.price, category: i.category }
      }));

      return NextResponse.json({ order }, { status: 200 });
    }

    // Obtener item actual
    const itemRows = await sql`SELECT product_id, quantity, price FROM order_items WHERE id = ${parseInt(itemId)}`;
    const item = itemRows[0];

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.quantity > 1) {
      // Disminuir cantidad
      await sql`UPDATE order_items SET quantity = quantity - 1 WHERE id = ${parseInt(itemId)}`;
    } else {
      // Eliminar item si llega a 0
      await sql`DELETE FROM order_items WHERE id = ${parseInt(itemId)}`;
    }

    // Restaurar 1 unidad de stock
    await sql`
      UPDATE products 
      SET stock = COALESCE(stock, 0) + 1
      WHERE id = ${item.product_id}
    `;

    // Registrar ajuste
    const reason = `Reducción de cantidad en Orden #${id}`;
    await sql`
      INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
      VALUES (${item.product_id}, 1, 'entry', ${reason}, ${user.id})
    `;

    // Actualizar total de la orden
    const totalResult = await sql`
      SELECT COALESCE(SUM(price * quantity), 0) as total 
      FROM order_items 
      WHERE order_id = ${parseInt(id)}
    `;
    const total = parseFloat(totalResult[0]?.total || 0);

    await sql`
      UPDATE orders 
      SET total_amount = ${total}, updated_at = NOW()
      WHERE id = ${parseInt(id)}
    `;

    // Obtener orden actualizada
    const orders = await sql`SELECT * FROM orders WHERE id = ${parseInt(id)}`;
    const order = orders[0];

    const items = await sql`
      SELECT oi.*, p.name as product_name, p.category
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${parseInt(id)}
    `;
    order.items = items.map(i => ({
      ...i,
      product: { name: i.product_name, price: i.price, category: i.category }
    }));

    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Patch item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
