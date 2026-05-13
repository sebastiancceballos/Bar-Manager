import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
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
      await sql`
        INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
        VALUES (${itemToRestore.product_id}, ${itemToRestore.quantity}, 'entry', 'Cancelación/Eliminación de item en Orden #' + ${id}, ${user.id})
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
