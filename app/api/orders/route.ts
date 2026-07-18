import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");

    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id;
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    let orders;
    if (tableId) {
      orders = await sql`
        SELECT o.*, t.table_number, u.name as waiter_name
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        LEFT JOIN users u ON o.waiter_id = u.id
        WHERE o.status NOT IN ('closed', 'paid')
          AND o.table_id = ${parseInt(tableId)}
          AND t.location_id = ${locId}
        ORDER BY o.created_at DESC
      `;
    } else {
      orders = await sql`
        SELECT o.*, t.table_number, u.name as waiter_name
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        LEFT JOIN users u ON o.waiter_id = u.id
        WHERE o.status NOT IN ('closed', 'paid')
          AND t.location_id = ${locId}
        ORDER BY o.created_at DESC
      `;
    }

    // Get items for each order
    for (const order of orders) {
      const items = await sql`
        SELECT oi.*, p.name as product_name, p.category
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${order.id}
      `;
      order.items = items.map(item => ({
        ...item,
        product: { name: item.product_name, price: item.price, category: item.category }
      }));
    }

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tableId } = await request.json();

    if (!tableId) {
      return NextResponse.json(
        { error: "Table ID is required" },
        { status: 400 }
      );
    }

    // Check if table already has open order
    const existingOrders = await sql`
      SELECT * FROM orders 
      WHERE table_id = ${parseInt(tableId)} AND status = 'open'
      LIMIT 1
    `;

    if (existingOrders.length > 0) {
      const order = existingOrders[0];
      const items = await sql`
        SELECT oi.*, p.name as product_name, p.category
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${order.id}
      `;
      order.items = items.map(item => ({
        ...item,
        product: { name: item.product_name, price: item.price, category: item.category }
      }));
      return NextResponse.json({ order }, { status: 200 });
    }

    // Create new order
    const orders = await sql`
      INSERT INTO orders (table_id, waiter_id, status, total_amount)
      VALUES (${parseInt(tableId)}, ${user.id}, 'open', 0)
      RETURNING *
    `;

    const order = orders[0];
    order.items = [];

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
