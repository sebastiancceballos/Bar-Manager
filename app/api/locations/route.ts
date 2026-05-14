import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let locations = [];

    if (currentUser.role === "owner") {
      // Superadmin (Project Owner) sees ALL bars
      locations = await sql`SELECT id, name, address FROM locations ORDER BY name ASC`;
    } else if (currentUser.role === "admin") {
      // Bar Owner (Admin) sees only their assigned bar
      const userLocRow = await sql`SELECT location_id FROM users WHERE id = ${currentUser.id} LIMIT 1`;
      const locId = userLocRow[0]?.location_id;
      
      if (locId) {
        locations = await sql`SELECT id, name, address FROM locations WHERE id = ${locId}`;
      }
    }

    return NextResponse.json({ locations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Only owner can create locations (bars)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (currentUser.role !== "owner") {
      return NextResponse.json({ error: "Solo el owner puede crear bares" }, { status: 403 });
    }

    const body = await request.json();
    const { name, address } = body;

    if (!name || !address) {
      return NextResponse.json({ error: "Nombre y direccion son requeridos" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO locations (name, address, owner_id)
      VALUES (${name}, ${address}, ${currentUser.id})
      RETURNING id, name, address, created_at
    `;

    const newLocation = Array.isArray(result) ? result[0] : result;

    return NextResponse.json({ location: newLocation }, { status: 201 });
  } catch (error) {
    console.error("Error creating location:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
