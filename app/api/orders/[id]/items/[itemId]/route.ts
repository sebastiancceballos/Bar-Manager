import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Delete item
    await prisma.orderItem.delete({
      where: { id: itemId },
    });

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
    console.error("Delete item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
