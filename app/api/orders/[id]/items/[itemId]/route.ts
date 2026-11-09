import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsOrder } from "@/lib/tenant";
import { apiT } from "@/lib/api-i18n";
import { toErrorResponse } from "@/lib/errors";
import { removeItemFromOrder, setItemKitchenStatus, updateItemNotes, incrementItemQuantity } from "@/lib/services/order-items";

const KITCHEN_STATUSES = ["pendiente", "preparando", "listo", "entregado"];

function parseIds(id: string, itemId: string) {
  const orderId = parseInt(id, 10);
  const item = parseInt(itemId, 10);
  return Number.isInteger(orderId) && Number.isInteger(item) ? { orderId, item } : null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: apiT(request, "apiUnauthorized") }, { status: 401 });
    }
    const { id, itemId } = await params;
    const ids = parseIds(id, itemId);
    if (!ids) return NextResponse.json({ error: apiT(request, "apiInvalidId") }, { status: 400 });

    const guard = await assertOwnsOrder(ids.orderId, user);
    if (guard.error) return guard.error;

    // Sin cambios de inventario: el stock solo se mueve al cobrar.
    const order = await removeItemFromOrder({
      orderId: ids.orderId,
      itemId: ids.item,
      userId: user.id,
      mode: "delete",
    });
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: apiT(request, "apiUnauthorized") }, { status: 401 });
    }
    const { id, itemId } = await params;
    const ids = parseIds(id, itemId);
    if (!ids) return NextResponse.json({ error: apiT(request, "apiInvalidId") }, { status: 400 });

    const guard = await assertOwnsOrder(ids.orderId, user);
    if (guard.error) return guard.error;

    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    const status = body?.status;
    if (action !== "decrement" && action !== "increment" && action !== "set_status" && action !== "set_notes") {
      return NextResponse.json({ error: apiT(request, "apiInvalidAction") }, { status: 400 });
    }

    if (action === "increment") {
      const order = await incrementItemQuantity({
        orderId: ids.orderId,
        itemId: ids.item,
        userId: user.id,
      });
      return NextResponse.json({ order }, { status: 200 });
    }

    if (action === "set_notes") {
      const notesRaw = body?.notes;
      const notes =
        notesRaw === null || notesRaw === undefined
          ? null
          : typeof notesRaw === "string"
            ? notesRaw.trim().slice(0, 300)
            : null;
      const order = await updateItemNotes({
        orderId: ids.orderId,
        itemId: ids.item,
        notes,
        userId: user.id,
      });
      return NextResponse.json({ order }, { status: 200 });
    }

    if (action === "set_status") {
      if (!status || !KITCHEN_STATUSES.includes(status)) {
        return NextResponse.json({ error: apiT(request, "apiInvalidStatus") }, { status: 400 });
      }
      const order = await setItemKitchenStatus({ orderId: ids.orderId, itemId: ids.item, status });
      return NextResponse.json({ order }, { status: 200 });
    }

    const order = await removeItemFromOrder({
      orderId: ids.orderId,
      itemId: ids.item,
      userId: user.id,
      mode: "decrement",
    });
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
