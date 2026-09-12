import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { sql } from "@/lib/db";
import { assertOwnsTable } from "@/lib/tenant";
import { normalizeTableNumber } from "@/lib/table-number";

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
    const capacity = body.capacity;
    const x_position = body.x_position;
    const y_position = body.y_position;
    const status = body.status;

    let table_number: string | null = null;
    if (body.table_number !== undefined && body.table_number !== null) {
      table_number = normalizeTableNumber(body.table_number);
      if (!table_number) {
        return NextResponse.json(
          { error: "Número de mesa inválido" },
          { status: 400 }
        );
      }
      const locRows = await sql`
        SELECT location_id FROM tables WHERE id = ${tableId} LIMIT 1
      `;
      const locId = locRows[0]?.location_id;
      if (locId) {
        const dup = await sql`
          SELECT id FROM tables
          WHERE location_id = ${locId}
            AND lower(trim(table_number)) = lower(${table_number})
            AND id <> ${tableId}
          LIMIT 1
        `;
        if (dup[0]) {
          return NextResponse.json(
            { error: `Ya existe la mesa ${table_number} en este bar` },
            { status: 409 }
          );
        }
      }
    }

    const tables = await sql`
      UPDATE tables SET
        table_number = COALESCE(${table_number}, table_number),
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
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe una mesa con ese número en este bar" },
        { status: 409 }
      );
    }
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
