import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locationId = userRow[0]?.location_id;
    if (!locationId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const tables = await sql`
      SELECT * FROM tables
      WHERE location_id = ${locationId}
      ORDER BY table_number ASC
    `;

    return NextResponse.json({ tables }, { status: 200 });
  } catch (error) {
    console.error("Get tables error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { table_number, capacity, x_position, y_position } = await request.json();

    if (table_number === undefined) {
      return NextResponse.json(
        { error: "Table number is required" },
        { status: 400 }
      );
    }

    const userRow2 = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locationId2 = userRow2[0]?.location_id;
    if (!locationId2) return NextResponse.json({ error: "Admin sin bar asignado" }, { status: 400 });

    const tables = await sql`
      INSERT INTO tables (location_id, table_number, capacity, x_position, y_position)
      VALUES (${locationId2}, ${table_number.toString()}, ${capacity || 4}, ${x_position || 0}, ${y_position || 0})
      RETURNING *
    `;

    return NextResponse.json({ table: tables[0] }, { status: 201 });
  } catch (error) {
    console.error("Create table error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}