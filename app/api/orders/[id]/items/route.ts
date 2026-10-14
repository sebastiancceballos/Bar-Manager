import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsOrder } from "@/lib/tenant";
import { apiT } from "@/lib/api-i18n";
import { toErrorResponse } from "@/lib/errors";
import { addItemToOrder, parseQuantity } from "@/lib/services/order-items";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: apiT(request, "apiUnauthorized") }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);
    const orderGuard = await assertOwnsOrder(orderId, user);
    if (orderGuard.error) return orderGuard.error;

    const body = await request.json().catch(() => ({}));
    const productId = Number(body?.productId);
    if (!Number.isInteger(productId) || productId <= 0 || body?.quantity === undefined) {
      return NextResponse.json(
        { error: apiT(request, "apiProductIdQuantityRequired") },
        { status: 400 }
      );
    }
    const quantity = parseQuantity(body.quantity);
    if (quantity === null) {
      return NextResponse.json(
        { error: apiT(request, "apiInvalidQuantityRange") },
        { status: 400 }
      );
    }

    // El inventario NO se toca aquí: se descuenta una sola vez, al cobrar.
    const { order, stockWarning } = await addItemToOrder({
      orderId,
      productId,
      quantity,
      userId: user.id,
    });
    return NextResponse.json(
      stockWarning ? { order, stockWarning } : { order },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
