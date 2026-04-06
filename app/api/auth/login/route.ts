import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, setAuthCookie } from "@/lib/auth";
import { sql } from "@/lib/db";

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
    console.log("[v0] Full result object:", JSON.stringify(result));
    console.log("[v0] Result type:", typeof result);
    console.log("[v0] Result is array?:", Array.isArray(result));
    
    // Neon returns array directly
    const users = Array.isArray(result) ? result : (result.rows || result);
    console.log("[v0] Processed users:", users);
    const user = Array.isArray(users) ? users[0] : users;

    if (!user) {
      console.log("[v0] User not found for email:", email);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("[v0] User found:", user.email);
    console.log("[v0] Password to check:", password);
    console.log("[v0] Hash in DB:", user.password_hash);
    
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log("[v0] Password valid?:", isPasswordValid);
    
    if (!isPasswordValid) {
      console.log("[v0] Password comparison failed");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("[v0] Login successful, creating token");
    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role as "admin" | "waiter",
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
    console.error("[v0] Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
