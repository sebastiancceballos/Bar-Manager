import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

// PATCH /api/owner/bars  { id, active }
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id, active } = await request.json();

    if (id === undefined || active === undefined) {
      return NextResponse.json({ error: "Faltan campos id y active" }, { status: 400 });
    }

    await sql`UPDATE locations SET active = ${active} WHERE id = ${parseInt(id)}`;

    return NextResponse.json({
      message: active ? "Bar activado" : "Bar desactivado",
      id,
      active
    }, { status: 200 });

  } catch (error) {
    console.error("Toggle bar error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}