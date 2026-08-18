import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, setAuthCookie } from "@/lib/auth";
import { sql } from "@/lib/db";

interface DbUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  failed_attempts: number;
  locked_until: string | null;
  must_change_password?: boolean;
}

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const result = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;

    // Neon returns array directly
    const users = result as DbUser[];
    const user = users[0];

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Bloqueo temporal por intentos fallidos repetidos
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${minutesLeft} min.` },
        { status: 429 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await sql`
          UPDATE users
          SET failed_attempts = 0, locked_until = NOW() + (${LOCK_MINUTES} * INTERVAL '1 minute')
          WHERE id = ${user.id}
        `;
        return NextResponse.json(
          { error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCK_MINUTES} minutos.` },
          { status: 429 }
        );
      }
      await sql`UPDATE users SET failed_attempts = ${attempts} WHERE id = ${user.id}`;
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Login correcto: limpiar contador de intentos
    if (user.failed_attempts > 0 || user.locked_until) {
      await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${user.id}`;
    }

    // Block admin/waiter if their bar is inactive
    if (user.role === "admin" || user.role === "waiter") {
      const locResult = await sql`
        SELECT l.active FROM users u
        LEFT JOIN locations l ON u.location_id = l.id
        WHERE u.id = ${user.id} LIMIT 1
      `;
      const loc = Array.isArray(locResult) ? locResult[0] : null;
      if (loc && loc.active === false) {
        return NextResponse.json(
          { error: "Tu bar está desactivado. Contacta al administrador." },
          { status: 403 }
        );
      }
    }

    const mustChangePassword = Boolean(
      (user as DbUser).must_change_password
    );

    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: mustChangePassword || undefined,
    });

    await setAuthCookie(token);

    // Contexto multi-sucursal (si la migración 11 ya corrió)
    let locationId = null as number | null;
    let organizationId = null as number | null;
    let locations: { id: number; name: string }[] = [];
    let activeLocationId: number | null = null;
    try {
      const extra = await sql`
        SELECT location_id, organization_id FROM users WHERE id = ${user.id} LIMIT 1
      `;
      locationId = extra[0]?.location_id ?? null;
      organizationId = extra[0]?.organization_id ?? null;
      if (user.role === "owner") {
        locations = (await sql`SELECT id, name FROM locations ORDER BY name`) as any;
      } else if (organizationId && user.role === "admin") {
        locations = (await sql`
          SELECT id, name FROM locations WHERE organization_id = ${organizationId} ORDER BY name
        `) as any;
      } else if (locationId) {
        locations = (await sql`SELECT id, name FROM locations WHERE id = ${locationId}`) as any;
      }
      activeLocationId = locationId || (locations[0]?.id ?? null);
    } catch {
      // sin columnas organization_id todavía
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          locationId,
          organizationId,
          activeLocationId,
          locations,
          mustChangePassword,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}