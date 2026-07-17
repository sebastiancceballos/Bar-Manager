import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id;
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const reservations = await sql`
      SELECT r.*, t.table_number
      FROM reservations r
      LEFT JOIN tables t ON r.table_id = t.id
      WHERE r.location_id = ${locId}
        AND r.reservation_time >= NOW() - INTERVAL '1 day'
      ORDER BY r.reservation_time ASC
    `;

    return NextResponse.json({ reservations }, { status: 200 });
  } catch (error) {
    console.error("Reservations GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
    const locId = locRow[0]?.location_id;
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const { customerName, phone, partySize, reservationTime, tableId, notes } = await request.json();

    if (!customerName || !reservationTime) {
      return NextResponse.json({ error: "Nombre y fecha/hora son obligatorios" }, { status: 400 });
    }

    const created = await sql`
      INSERT INTO reservations (location_id, table_id, customer_name, phone, party_size, reservation_time, notes, created_by)
      VALUES (${locId}, ${tableId || null}, ${customerName}, ${phone || null}, ${partySize || 2}, ${reservationTime}, ${notes || null}, ${user.id})
      RETURNING *
    `;

    return NextResponse.json({ reservation: created[0] }, { status: 201 });
  } catch (error) {
    console.error("Reservations POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
