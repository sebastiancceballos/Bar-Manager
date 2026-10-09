import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { apiT } from "@/lib/api-i18n";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: apiT(request, "apiNotAuthenticated") }, { status: 401 });
    }

    const result = await sql`
      SELECT l.id, l.name, l.address
      FROM users u
      JOIN locations l ON u.location_id = l.id
      WHERE u.id = ${user.id}
      LIMIT 1
    `;

    const location = Array.isArray(result) ? result[0] : null;

    if (!location) {
      return NextResponse.json({ error: apiT(request, "apiNoLocationAssigned") }, { status: 404 });
    }

    return NextResponse.json(
      { id: location.id, name: location.name, address: location.address },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user location:", error);
    return NextResponse.json({ error: apiT(request, "apiInternalError") }, { status: 500 });
  }
}