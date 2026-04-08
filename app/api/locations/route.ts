import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await sql`SELECT id, name, address FROM locations ORDER BY name ASC`;
    const locations = Array.isArray(result) ? result : [];

    return NextResponse.json({ locations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
