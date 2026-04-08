import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, UserRole } from "@/lib/auth";
import { sql } from "@/lib/db";

// What roles can each role delete
const ALLOWED_DELETIONS: Record<UserRole, UserRole[]> = {
  owner: ["admin", "waiter"],
  admin: ["waiter"],
  waiter: [],
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const targetId = parseInt(id);

    if (isNaN(targetId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Cannot delete yourself
    if (targetId === currentUser.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta" },
        { status: 400 }
      );
    }

    // Fetch target user
    const result = await sql`SELECT id, name, email, role, location_id FROM users WHERE id = ${targetId} LIMIT 1`;
    const users = Array.isArray(result) ? result : [];
    const targetUser = users[0];

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const allowedRoles = ALLOWED_DELETIONS[currentUser.role as UserRole] || [];

    if (!allowedRoles.includes(targetUser.role as UserRole)) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar este usuario" },
        { status: 403 }
      );
    }

    // Admin can only delete waiters from their own location
    if (currentUser.role === "admin") {
      const adminResult = await sql`SELECT location_id FROM users WHERE id = ${currentUser.id} LIMIT 1`;
      const adminUsers = Array.isArray(adminResult) ? adminResult : [];
      const adminData = adminUsers[0];

      if (adminData?.location_id && targetUser.location_id !== adminData.location_id) {
        return NextResponse.json(
          { error: "Solo puedes eliminar meseros de tu propio bar" },
          { status: 403 }
        );
      }
    }

    await sql`DELETE FROM users WHERE id = ${targetId}`;

    return NextResponse.json(
      { message: `Usuario ${targetUser.name} eliminado correctamente` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
