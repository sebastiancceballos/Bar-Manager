import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getAccessibleLocations, resolveLocationId } from "@/lib/org";
import { apiT } from "@/lib/api-i18n";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: apiT(request, "apiUnauthorized") }, { status: 401 });

    const locations = await getAccessibleLocations(user.id, user.role);
    const activeLocationId = await resolveLocationId(user.id, user.role);

    return NextResponse.json(
      { locations, activeLocationId },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET me/locations:", error);
    return NextResponse.json({ error: apiT(request, "apiInternalError") }, { status: 500 });
  }
}
