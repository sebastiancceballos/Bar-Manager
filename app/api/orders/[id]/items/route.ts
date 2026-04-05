import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Create or get order item
    const existingItem = await prisma.orderItem.findFirst({
      where: {
        orderId: id,
        productId,
      },
    });

    let item;
    if (existingItem) {
      item = await prisma.orderItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
        },
      });
    } else {
      item = await prisma.orderItem.create({
        data: {
          orderId: id,
          productId,
          quantity,
          price: product.price,
        },
      });
    }

    // Update order total
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: id },
    });

    const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = await prisma.order.update({
      where: { id },
      data: { total },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
      },
    });

    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Add item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
