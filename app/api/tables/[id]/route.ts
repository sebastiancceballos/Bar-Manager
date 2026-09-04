import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { sql } from "@/lib/db";
import { assertOwnsTable } from "@/lib/tenant";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const tableId = parseInt(id, 10);
    const guard = await assertOwnsTable(tableId, user);
    if (guard.error) return guard.error;

    const body = await request.json();
    const { table_number, capacity, x_position, y_position, status } = body;

    const tables = await sql`
      UPDATE tables 
      SET table_number = COALESCE(${table_number ?? null}, table_number),
          capacity = COALESCE(${capacity ?? null}, capacity),
          x_position = COALESCE(${x_position ?? null}, x_position),
          y_position = COALESCE(${y_position ?? null}, y_position),
          status = COALESCE(${status ?? null}, status),
          updated_at = NOW()
      WHERE id = ${tableId}
      RETURNING *
    `;

    if (!tables[0]) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ table: tables[0] }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const tableId = parseInt(id, 10);
    const guard = await assertOwnsTable(tableId, user);
    if (guard.error) return guard.error;

    await sql`DELETE FROM tables WHERE id = ${tableId}`;

    return NextResponse.json({ message: "Table deleted" }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
