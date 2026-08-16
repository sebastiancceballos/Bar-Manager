import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

/** GET: list orgs (superadmin all; admin only own). POST: create org (superadmin). */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.role === "owner") {
      const orgs = await sql`
        SELECT o.id, o.name, o.status, o.created_at,
          (SELECT COUNT(*)::int FROM locations l WHERE l.organization_id = o.id) AS location_count,
          (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role = 'admin') AS admin_count
        FROM organizations o
        ORDER BY o.name
      `;
      return NextResponse.json({ organizations: orgs }, { status: 200 });
    }

    if (user.role === "admin") {
      const orgRows = await sql`
        SELECT organization_id FROM users WHERE id = ${user.id} LIMIT 1
      `;
      const orgId = orgRows[0]?.organization_id;
      if (!orgId) return NextResponse.json({ organizations: [] }, { status: 200 });
      const orgs = await sql`
        SELECT o.id, o.name, o.status, o.created_at,
          (SELECT COUNT(*)::int FROM locations l WHERE l.organization_id = o.id) AS location_count,
          (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role = 'admin') AS admin_count
        FROM organizations o WHERE o.id = ${orgId}
      `;
      return NextResponse.json({ organizations: orgs }, { status: 200 });
    }

    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  } catch (error) {
    console.error("GET organizations:", error);
    return NextResponse.json(
      { error: "Error al listar organizaciones. ¿Corriste scripts/11_organizations.sql?" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: "Solo Superadmin puede crear organizaciones" }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO organizations (name, status)
      VALUES (${String(name).trim()}, 'active')
      RETURNING id, name, status, created_at
    `;
    return NextResponse.json({ organization: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST organizations:", error);
    return NextResponse.json(
      { error: "Error al crear. ¿Corriste scripts/11_organizations.sql?" },
      { status: 500 }
    );
  }
}
