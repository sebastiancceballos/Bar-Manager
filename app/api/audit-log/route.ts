import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    let locId: number | null = null;
    if (user.role === "admin") {
      const locRow = await sql`SELECT location_id FROM users WHERE id = ${user.id} LIMIT 1`;
      locId = locRow[0]?.location_id ?? null;
      if (!locId) return NextResponse.json({ error: "Admin sin bar asignado" }, { status: 400 });
    }

    const rows = locId
      ? await sql`
          SELECT a.*, u.name as user_name
          FROM audit_log a
          LEFT JOIN users u ON a.user_id = u.id
          WHERE a.location_id = ${locId}
          ORDER BY a.created_at DESC
          LIMIT 200
        `
      : await sql`
          SELECT a.*, u.name as user_name
          FROM audit_log a
          LEFT JOIN users u ON a.user_id = u.id
          ORDER BY a.created_at DESC
          LIMIT 200
        `;

    return NextResponse.json({ entries: rows }, { status: 200 });
  } catch (error) {
    console.error("Audit log error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
