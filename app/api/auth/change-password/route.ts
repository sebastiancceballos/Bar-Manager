import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthUser, signToken, setAuthCookie } from "@/lib/auth";
import { sql } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";
import { apiT } from "@/lib/api-i18n";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: apiT(request, "apiNotAuthenticated") }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    if (!newPassword || String(newPassword).length < 8) {
      return NextResponse.json(
        { error: apiT(request, "apiNewPasswordMin8") },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT id, email, role, password_hash, must_change_password
      FROM users WHERE id = ${user.id} LIMIT 1
    `;
    const dbUser = rows[0];
    if (!dbUser) {
      return NextResponse.json({ error: apiT(request, "apiUserNotFound") }, { status: 404 });
    }

    // Si no es forzado, exigir contraseña actual
    if (!dbUser.must_change_password) {
      if (!currentPassword) {
        return NextResponse.json({ error: apiT(request, "apiCurrentPasswordRequired") }, { status: 400 });
      }
      const ok = await bcrypt.compare(currentPassword, dbUser.password_hash);
      if (!ok) {
        return NextResponse.json({ error: apiT(request, "apiCurrentPasswordIncorrect") }, { status: 401 });
      }
    }

    const hash = await bcrypt.hash(String(newPassword), 12);
    await sql`
      UPDATE users
      SET password_hash = ${hash},
          must_change_password = false,
          failed_attempts = 0,
          locked_until = NULL
      WHERE id = ${user.id}
    `;

    const token = await signToken({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      // sin mustChangePassword
    });
    await setAuthCookie(token);

    return NextResponse.json({
      message: apiT(request, "apiPasswordUpdated"),
      mustChangePassword: false,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
