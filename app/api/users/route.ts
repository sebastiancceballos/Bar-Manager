import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    let users;

    if (currentUser.role === "owner") {
      // Owner sees all users grouped with location info
      const result = await sql`
        SELECT u.id, u.name, u.email, u.role, u.location_id, u.created_at,
               l.name AS location_name
        FROM users u
        LEFT JOIN locations l ON u.location_id = l.id
        ORDER BY 
          CASE u.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'waiter' THEN 3 END,
          l.name ASC,
          u.created_at DESC
      `;
      users = Array.isArray(result) ? result : [];
    } else {
      // Admin sees only users from their own location
      const adminResult = await sql`SELECT location_id FROM users WHERE id = ${currentUser.id} LIMIT 1`;
      const adminData = Array.isArray(adminResult) ? adminResult[0] : null;
      const locationId = adminData?.location_id;

      if (!locationId) {
        // Admin without location sees only themselves
        users = [];
      } else {
        const result = await sql`
          SELECT u.id, u.name, u.email, u.role, u.location_id, u.created_at,
                 l.name AS location_name
          FROM users u
          LEFT JOIN locations l ON u.location_id = l.id
          WHERE u.location_id = ${locationId} AND u.role = 'waiter'
          ORDER BY u.created_at DESC
        `;
        users = Array.isArray(result) ? result : [];
      }
    }

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
