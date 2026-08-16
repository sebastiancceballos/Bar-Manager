import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAccessibleLocations } from "@/lib/org";

export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const locations = await getAccessibleLocations(currentUser.id, currentUser.role);
    return NextResponse.json({ locations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** Superadmin crea sucursal; puede indicar organization_id o se crea org automática */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (currentUser.role !== "owner") {
      return NextResponse.json(
        { error: "Solo Superadmin puede crear sucursales" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, address, organizationId } = body;

    if (!name || !address) {
      return NextResponse.json({ error: "Nombre y dirección son requeridos" }, { status: 400 });
    }

    let orgId: number | null =
      organizationId != null ? parseInt(String(organizationId), 10) : null;

    if (orgId && Number.isNaN(orgId)) {
      return NextResponse.json({ error: "organizationId inválido" }, { status: 400 });
    }

    // Si no mandan org, crear una con el nombre del bar
    if (!orgId) {
      const orgRows = await sql`
        INSERT INTO organizations (name, status)
        VALUES (${String(name).trim()}, 'active')
        RETURNING id
      `;
      orgId = orgRows[0].id;
    } else {
      const exists = await sql`SELECT id FROM organizations WHERE id = ${orgId} LIMIT 1`;
      if (!exists[0]) {
        return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
      }
    }

    const result = await sql`
      INSERT INTO locations (name, address, owner_id, organization_id)
      VALUES (${name}, ${address}, ${currentUser.id}, ${orgId})
      RETURNING id, name, address, organization_id, created_at
    `;

    return NextResponse.json({ location: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating location:", error);
    return NextResponse.json(
      {
        error:
          "Error al crear sucursal. ¿Corriste scripts/11_organizations.sql en Neon?",
      },
      { status: 500 }
    );
  }
}
