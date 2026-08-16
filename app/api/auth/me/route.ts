import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAccessibleLocations, resolveLocationId } from "@/lib/org";

export async function GET() {
  try {
    const payload = await getAuthUser();
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rows = await sql`
      SELECT id, email, name, role, location_id, organization_id
      FROM users WHERE id = ${payload.id} LIMIT 1
    `;
    const dbUser = rows[0];
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    let locations: Awaited<ReturnType<typeof getAccessibleLocations>> = [];
    let activeLocationId: number | null = null;
    try {
      locations = await getAccessibleLocations(dbUser.id, dbUser.role);
      activeLocationId = await resolveLocationId(dbUser.id, dbUser.role);
    } catch {
      // org tables may not exist yet
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        locationId: dbUser.location_id,
        organizationId: dbUser.organization_id,
        activeLocationId,
        locations,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
