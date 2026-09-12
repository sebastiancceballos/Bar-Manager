import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";
import {
  normalizeTableNumber,
  compareTableNumbers,
} from "@/lib/table-number";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locationId = await resolveLocationId(user.id, user.role);
    if (!locationId) {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    const rows = await sql`
      SELECT * FROM tables
      WHERE location_id = ${locationId}
    `;

    const tables = [...rows].sort((a: any, b: any) =>
      compareTableNumbers(String(a.table_number), String(b.table_number))
    );

    // Siguiente número libre (máx numérico + 1)
    let maxNum = 0;
    for (const t of tables as any[]) {
      const n = String(t.table_number);
      if (/^\d+$/.test(n)) maxNum = Math.max(maxNum, parseInt(n, 10));
    }
    const nextNumber = maxNum + 1;

    return NextResponse.json({ tables, nextNumber }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const table_number = normalizeTableNumber(body.table_number);
    const capacity = Math.min(20, Math.max(1, Number(body.capacity) || 4));
    const x_position = Number(body.x_position) || 0;
    const y_position = Number(body.y_position) || 0;

    if (!table_number) {
      return NextResponse.json(
        { error: "El número de mesa es obligatorio" },
        { status: 400 }
      );
    }

    const locationId = await resolveLocationId(user.id, user.role);
    if (!locationId) {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM tables
      WHERE location_id = ${locationId}
        AND lower(trim(table_number)) = lower(${table_number})
      LIMIT 1
    `;
    if (existing[0]) {
      return NextResponse.json(
        { error: `Ya existe la mesa ${table_number} en este bar` },
        { status: 409 }
      );
    }

    const tables = await sql`
      INSERT INTO tables (location_id, table_number, capacity, x_position, y_position)
      VALUES (
        ${locationId},
        ${table_number},
        ${capacity},
        ${x_position},
        ${y_position}
      )
      RETURNING *
    `;

    return NextResponse.json({ table: tables[0] }, { status: 201 });
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
