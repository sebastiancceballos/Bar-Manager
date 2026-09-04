import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { ACTIVE_LOCATION_COOKIE, userCanAccessLocation } from "@/lib/org";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { locationId } = await request.json();
    const id = parseInt(locationId, 10);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "locationId inválido" }, { status: 400 });
    }

    const ok = await userCanAccessLocation(user.id, user.role, id);
    if (!ok) {
      return NextResponse.json({ error: "No tienes acceso a esa sucursal" }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_LOCATION_COOKIE, String(id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({ activeLocationId: id }, { status: 200 });
  } catch (error) {
    console.error("POST active-location:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
