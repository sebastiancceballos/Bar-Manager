import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, UserRole } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { sql } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

// What roles can each role delete
const ALLOWED_DELETIONS: Record<UserRole, UserRole[]> = {
  owner: ["admin", "waiter", "cashier", "kitchen"],
  admin: ["waiter", "cashier", "kitchen"],
  waiter: [],
  cashier: [],
  kitchen: [],
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

    // Admin can only delete staff from their active location
    if (currentUser.role === "admin") {
      const adminLoc = await resolveLocationId(currentUser.id, currentUser.role);
      if (adminLoc && targetUser.location_id !== adminLoc) {
        return NextResponse.json(
          { error: "Solo puedes eliminar meseros de tu propio bar" },
          { status: 403 }
        );
      }
    }

    await sql`DELETE FROM users WHERE id = ${targetId}`;

    await logAudit({
      locationId: targetUser.location_id,
      userId: currentUser.id,
      action: "delete_user",
      entityType: "user",
      entityId: targetId,
      details: `Eliminó a ${targetUser.name} (${targetUser.email}, rol ${targetUser.role})`,
    });

    return NextResponse.json(
      { message: `Usuario ${targetUser.name} eliminado correctamente` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Restablecer la contraseña de un usuario (solo admin/owner, respetando jerarquía y bar)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (currentUser.role !== "admin" && currentUser.role !== "owner") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const targetId = parseInt(id);
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    const result = await sql`SELECT id, name, email, role, location_id FROM users WHERE id = ${targetId} LIMIT 1`;
    const targetUser = result[0];
    if (!targetUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const allowedRoles = ALLOWED_DELETIONS[currentUser.role as UserRole] || [];
    const canManage = targetId === currentUser.id || allowedRoles.includes(targetUser.role as UserRole);
    if (!canManage) {
      return NextResponse.json({ error: "No tienes permiso sobre este usuario" }, { status: 403 });
    }

    if (currentUser.role === "admin" && targetId !== currentUser.id) {
      const adminLoc = await resolveLocationId(currentUser.id, currentUser.role);
      if (adminLoc && targetUser.location_id !== adminLoc) {
        return NextResponse.json({ error: "Solo puedes restablecer contraseñas de tu propio bar" }, { status: 403 });
      }
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${hash}, failed_attempts = 0, locked_until = NULL WHERE id = ${targetId}`;

    await logAudit({
      locationId: targetUser.location_id,
      userId: currentUser.id,
      action: "reset_password",
      entityType: "user",
      entityId: targetId,
      details: `Restableció la contraseña de ${targetUser.name} (${targetUser.email})`,
    });

    return NextResponse.json({ message: "Contraseña actualizada" }, { status: 200 });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
