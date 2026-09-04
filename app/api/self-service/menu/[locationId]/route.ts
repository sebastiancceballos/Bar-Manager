import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Público a propósito: el cliente escanea un QR y no tiene sesión.
// Solo expone lo que un menú necesita mostrar; nada sensible (stock,
// costos internos, etc.) sale por esta ruta.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const locId = parseInt(locationId);

    if (!locId || Number.isNaN(locId)) {
      return NextResponse.json({ error: "Bar inválido" }, { status: 400 });
    }

    const locationRows = await sql`
      SELECT id, name, self_service_enabled FROM locations
      WHERE id = ${locId} AND active = true
      LIMIT 1
    `;
    const location = locationRows[0];

    if (!location) {
      return NextResponse.json({ error: "Bar no encontrado" }, { status: 404 });
    }

    if (!location.self_service_enabled) {
      return NextResponse.json(
        { error: "El autoservicio no está disponible en este bar" },
        { status: 403 }
      );
    }

    const products = await sql`
      SELECT id, name, category, price, description, image_url
      FROM products
      WHERE location_id = ${locId} AND available = true
      ORDER BY category ASC, name ASC
    `;

    return NextResponse.json(
      { location: { id: location.id, name: location.name }, products },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get self-service menu error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
