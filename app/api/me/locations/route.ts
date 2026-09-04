import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getAccessibleLocations, resolveLocationId } from "@/lib/org";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const locations = await getAccessibleLocations(user.id, user.role);
    const activeLocationId = await resolveLocationId(user.id, user.role);

    return NextResponse.json(
      { locations, activeLocationId },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET me/locations:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
