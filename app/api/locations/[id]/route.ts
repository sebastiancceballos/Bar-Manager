import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsLocation } from "@/lib/tenant";
import { sql } from "@/lib/db";
import { apiT } from "@/lib/api-i18n";

// Only owner can delete locations
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: apiT(request, "apiNotAuthenticated") }, { status: 401 });
    }

    if (currentUser.role !== "owner") {
      return NextResponse.json({ error: apiT(request, "apiOnlyOwnerDeleteLocations") }, { status: 403 });
    }

    const { id } = await params;
    const locationId = parseInt(id);
    const locGuard = await assertOwnsLocation(locationId, currentUser);
    if (locGuard.error) return locGuard.error;


    if (isNaN(locationId)) {
      return NextResponse.json({ error: apiT(request, "apiInvalidId") }, { status: 400 });
    }

    // Check if location has users assigned
    const usersResult = await sql`SELECT COUNT(*) as count FROM users WHERE location_id = ${locationId}`;
    const usersCount = Array.isArray(usersResult) ? Number(usersResult[0]?.count || 0) : 0;

    if (usersCount > 0) {
      return NextResponse.json(
        { error: apiT(request, "apiCannotDeleteHasUsers", { count: usersCount }) },
        { status: 400 }
      );
    }

    // Check if location has tables
    const tablesResult = await sql`SELECT COUNT(*) as count FROM tables WHERE location_id = ${locationId}`;
    const tablesCount = Array.isArray(tablesResult) ? Number(tablesResult[0]?.count || 0) : 0;

    if (tablesCount > 0) {
      return NextResponse.json(
        { error: apiT(request, "apiCannotDeleteHasTables", { count: tablesCount }) },
        { status: 400 }
      );
    }

    await sql`DELETE FROM locations WHERE id = ${locationId}`;

    return NextResponse.json({ message: apiT(request, "apiLocationDeletedSuccess") }, { status: 200 });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json({ error: apiT(request, "internalServerError") }, { status: 500 });
  }
}

// Update location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: apiT(request, "apiNotAuthenticated") }, { status: 401 });
    }

    if (currentUser.role !== "owner") {
      return NextResponse.json({ error: apiT(request, "apiOnlyOwnerEditLocations") }, { status: 403 });
    }

    const { id } = await params;
    const locationId = parseInt(id);
    const locGuard = await assertOwnsLocation(locationId, currentUser);
    if (locGuard.error) return locGuard.error;

    const body = await request.json();
    const { name, address } = body;

    if (!name || !address) {
      return NextResponse.json({ error: apiT(request, "apiNameAddressRequired") }, { status: 400 });
    }

    const result = await sql`
      UPDATE locations
      SET name = ${name}, address = ${address}, updated_at = NOW()
      WHERE id = ${locationId}
      RETURNING id, name, address
    `;

    const location = Array.isArray(result) ? result[0] : result;

    return NextResponse.json({ location }, { status: 200 });
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json({ error: apiT(request, "internalServerError") }, { status: 500 });
  }
}
