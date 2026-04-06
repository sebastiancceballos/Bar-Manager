import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    let orders;
    if (status === "closed") {
      orders = await sql`
        UPDATE orders 
        SET status = ${status}, closed_at = NOW(), updated_at = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;
    } else {
      orders = await sql`
        UPDATE orders 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;
    }

    const order = orders[0];

    // Get items
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
    console.error("Update order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const orders = await sql`SELECT * FROM orders WHERE id = ${parseInt(id)}`;
    const order = orders[0];

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get items
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
    console.error("Get order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
