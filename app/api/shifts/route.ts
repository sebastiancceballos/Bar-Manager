import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const open = await sql`
      SELECT * FROM shifts WHERE user_id = ${user.id} AND clock_out IS NULL LIMIT 1
    `;
    const history = await sql`
      SELECT * FROM shifts WHERE user_id = ${user.id} AND clock_out IS NOT NULL
      ORDER BY clock_in DESC LIMIT 20
    `;

    return NextResponse.json({ open: open[0] || null, history }, { status: 200 });
  } catch (error) {
    console.error("Shifts GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Marca entrada o salida (toggle) según si ya hay un turno abierto
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id ?? null;

    const open = await sql`
      SELECT * FROM shifts WHERE user_id = ${user.id} AND clock_out IS NULL LIMIT 1
    `;

    if (open.length > 0) {
      const updated = await sql`
        UPDATE shifts SET clock_out = NOW() WHERE id = ${open[0].id}
        RETURNING *
      `;
      return NextResponse.json({ shift: updated[0], action: "clock_out" }, { status: 200 });
    }

    let created;
    try {
      created = await sql`
        INSERT INTO shifts (user_id, location_id)
        VALUES (${user.id}, ${locId})
        RETURNING *
      `;
    } catch {
      return NextResponse.json({ error: "Ya tienes un turno abierto" }, { status: 409 });
    }
    return NextResponse.json({ shift: created[0], action: "clock_in" }, { status: 201 });
  } catch (error) {
    console.error("Shifts POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
