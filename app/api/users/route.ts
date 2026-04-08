import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Only owner and admin can list users
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "No tienes permiso para ver usuarios" },
        { status: 403 }
      );
    }

    // Fetch all users (without password_hash)
    const result = await sql`
      SELECT id, name, email, role, location_id, created_at, updated_at
      FROM users
      ORDER BY 
        CASE role 
          WHEN 'owner' THEN 1 
          WHEN 'admin' THEN 2 
          WHEN 'waiter' THEN 3 
        END,
        created_at DESC
    `;

    const users = Array.isArray(result) ? result : [];

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
