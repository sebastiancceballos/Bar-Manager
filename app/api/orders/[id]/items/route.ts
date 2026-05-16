import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { productId, quantity } = await request.json();

    if (!productId || !quantity) {
      return NextResponse.json(
        { error: "Product ID and quantity are required" },
        { status: 400 }
      );
    }

    // Get product to get price
    const products = await sql`SELECT * FROM products WHERE id = ${parseInt(productId)}`;
    const product = products[0];

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // --- BLOQUEO DE VENTA SIN STOCK ---
    const currentStock = product.stock || 0;
    if (currentStock < quantity) {
      return NextResponse.json(
        { error: `¡Sin Stock! Solo quedan ${currentStock} unidades de ${product.name}. Por favor reponer.` },
        { status: 400 }
      );
    }
    // ----------------------------------

    // Check if item already exists
    const existingItems = await sql`
      SELECT * FROM order_items 
      WHERE order_id = ${parseInt(id)} AND product_id = ${parseInt(productId)}
    `;

    if (existingItems.length > 0) {
      // Update quantity
      await sql`
        UPDATE order_items 
        SET quantity = quantity + ${quantity}
        WHERE order_id = ${parseInt(id)} AND product_id = ${parseInt(productId)}
      `;
    } else {
      // Create new item
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${parseInt(id)}, ${parseInt(productId)}, ${quantity}, ${product.price})
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
      SET total_amount = ${total}, updated_at = NOW(), modified_by = ${user.id}
      WHERE id = ${parseInt(id)}
    `;

    // --- LOGICA DE TRAZABILIDAD ---
    // Ensure stock columns/tables exist before using them
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0`;
      await sql`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id SERIAL PRIMARY KEY,
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL,
          type VARCHAR(20) NOT NULL,
          reason TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
    } catch (_) {}

    // Descontar stock automáticamente al agregar al pedido
    await sql`
      UPDATE products 
      SET stock = COALESCE(stock, 0) - ${quantity}
      WHERE id = ${parseInt(productId)}
    `;

    // Registrar el movimiento de salida por venta
    const reason = `Venta en mesa (Orden #${id})`;
    await sql`
      INSERT INTO stock_movements (product_id, quantity, type, reason, created_by)
      VALUES (${parseInt(productId)}, ${quantity}, 'sale', ${reason}, ${user.id})
    `;
    // ------------------------------

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
    console.error("Add item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}