import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locId = await resolveLocationId(user.id, user.role);
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

// Cuánto tiempo se asume que una reserva "ocupa" la mesa. No se permite otra
// reserva en la misma mesa dentro de esta ventana antes/después.
const RESERVATION_BUFFER_HOURS = 2;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });

    const { customerName, phone, partySize, reservationTime, tableId, notes } = await request.json();

    if (!customerName || !reservationTime) {
      return NextResponse.json({ error: "Nombre y fecha/hora son obligatorios" }, { status: 400 });
    }

    // Regla de negocio: no se puede reservar la misma mesa dos veces cerca
    // de la misma hora. Solo aplica si se eligió una mesa específica.
    if (tableId) {
      const conflicts = await sql`
        SELECT r.id, r.customer_name, r.reservation_time
        FROM reservations r
        WHERE r.table_id = ${parseInt(tableId)}
          AND r.location_id = ${locId}
          AND r.status != 'cancelada'
          AND r.reservation_time > ${reservationTime}::timestamp - (${RESERVATION_BUFFER_HOURS} * INTERVAL '1 hour')
          AND r.reservation_time < ${reservationTime}::timestamp + (${RESERVATION_BUFFER_HOURS} * INTERVAL '1 hour')
        LIMIT 1
      `;

      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        const conflictTime = new Date(conflict.reservation_time).toLocaleString("es-CO", {
          dateStyle: "short",
          timeStyle: "short",
        });
        return NextResponse.json(
          {
            error: `Esa mesa ya tiene una reserva de ${conflict.customer_name} a las ${conflictTime}. Debe haber al menos ${RESERVATION_BUFFER_HOURS} horas de diferencia entre reservas de la misma mesa.`,
          },
          { status: 409 }
        );
      }
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
