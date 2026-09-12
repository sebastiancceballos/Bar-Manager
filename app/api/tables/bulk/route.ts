import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";

const MAX_BULK = 50;

/**
 * POST { from: number, to: number, capacity?: number }
 * Crea mesas from..to inclusive. Falla si alguna ya existe.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const body = await request.json();
    const from = parseInt(String(body.from), 10);
    const to = parseInt(String(body.to), 10);
    const capacity = Math.min(20, Math.max(1, Number(body.capacity) || 4));

    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < 1) {
      return NextResponse.json(
        { error: "Desde y Hasta deben ser números enteros mayores a 0" },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: "El número inicial no puede ser mayor que el final" },
        { status: 400 }
      );
    }
    const count = to - from + 1;
    if (count > MAX_BULK) {
      return NextResponse.json(
        { error: `Máximo ${MAX_BULK} mesas por lote` },
        { status: 400 }
      );
    }

    const locationId = await resolveLocationId(user.id, user.role);
    if (!locationId) {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    const numbers = Array.from({ length: count }, (_, i) => String(from + i));

    const existing = await sql`
      SELECT table_number FROM tables
      WHERE location_id = ${locationId}
        AND table_number = ANY(${numbers})
    `;
    if (existing.length > 0) {
      const nums = existing.map((r: any) => r.table_number).join(", ");
      return NextResponse.json(
        {
          error: `Ya existen mesas en este rango: ${nums}. Elige otro rango.`,
        },
        { status: 409 }
      );
    }

    const created: any[] = [];
    for (let i = 0; i < numbers.length; i++) {
      const num = numbers[i];
      // Layout simple en rejilla
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 40 + col * 100;
      const y = 40 + row * 100;
      const rows = await sql`
        INSERT INTO tables (location_id, table_number, capacity, x_position, y_position)
        VALUES (${locationId}, ${num}, ${capacity}, ${x}, ${y})
        RETURNING *
      `;
      created.push(rows[0]);
    }

    return NextResponse.json(
      {
        created: created.length,
        tables: created,
        message: `Se crearon ${created.length} mesas (${from}–${to})`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Conflicto: alguna mesa del rango ya existe" },
        { status: 409 }
      );
    }
    return toErrorResponse(error);
  }
}
