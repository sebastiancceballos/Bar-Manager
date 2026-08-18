import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsOrder } from "@/lib/tenant";
import { sql } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";
import {
  attachOrderItems,
  transferOrderToTable,
  closeOrderWithPayment,
  setOrderManualStatus,
} from "@/lib/services/orders";

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
    const orderId = parseInt(id, 10);
    const body = await request.json();

    const orderGuard = await assertOwnsOrder(orderId, user);
    if (orderGuard.error) return orderGuard.error;

    const {
      status,
      newTableId,
      paymentMethod,
      tipAmount,
      discountAmount,
      discountReason,
      authorizerEmail,
      authorizerPassword,
      amountReceived,
    } = body;

    // Transferir a otra mesa
    if (newTableId !== undefined) {
      const existing = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
      const current = existing[0];
      if (!current) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      const result = await transferOrderToTable({
        orderId,
        newTableId: parseInt(String(newTableId), 10),
        user,
        current,
      });
      if ("errorResponse" in result && result.errorResponse) {
        return result.errorResponse;
      }
      return NextResponse.json({ order: (result as { order: unknown }).order }, { status: 200 });
    }

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    // Cobrar / cerrar
    if (status === "closed" || status === "paid") {
      const result = await closeOrderWithPayment({
        orderId,
        user,
        status,
        paymentMethod,
        tipAmount,
        discountAmount,
        discountReason,
        authorizerEmail,
        authorizerPassword,
        amountReceived,
        locationId: orderGuard.locationId ?? null,
      });
      return NextResponse.json(result, { status: 200 });
    }

    // Estado manual (cuenta pedida, etc.)
    const order = await setOrderManualStatus({ orderId, user, status });
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    const orderGuard = await assertOwnsOrder(orderId, user);
    if (orderGuard.error) return orderGuard.error;

    const orders = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    let order = orders[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    order = await attachOrderItems(order);
    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
