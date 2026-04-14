import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, setAuthCookie } from "@/lib/auth";
import { sql } from "@/lib/db";

interface DbUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: "owner" | "admin" | "waiter";
}

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

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
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

    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await setAuthCookie(token);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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