import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthUser, UserRole } from "@/lib/auth";
import { sql } from "@/lib/db";

/**
 * POST /api/auth/register
 * 
 * Creates a new user with role-based access control.
 * 
 * Permissions:
 * - "owner" can create "admin" users
 * - "admin" can create "waiter" users
 * - No one can create users with a higher role than their own
 * 
 * Request body example:
 * {
 *   "name": "Juan Pérez",
 *   "email": "juan@example.com",
 *   "password": "securepassword123",
 *   "role": "waiter"
 * }
 * 
 * Responses:
 * - 201: User created successfully
 * - 400: Validation error (missing fields, invalid role, email exists)
 * - 401: Not authenticated
 * - 403: Permission denied (trying to create user with higher/equal role)
 * - 500: Internal server error
 */

// Role hierarchy: owner > admin > waiter
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 3,
  admin: 2,
  waiter: 1,
};

// What roles can each role create
const ALLOWED_CREATIONS: Record<UserRole, UserRole[]> = {
  owner: ["admin"],
  admin: ["waiter"],
  waiter: [],
};

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const currentUser = await getAuthUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: "No autenticado. Debes iniciar sesión para crear usuarios." },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const { name, email, password, role } = body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { 
          error: "Campos requeridos faltantes",
          details: {
            name: !name ? "El nombre es requerido" : null,
            email: !email ? "El email es requerido" : null,
            password: !password ? "La contraseña es requerida" : null,
            role: !role ? "El rol es requerido" : null,
          }
        },
        { status: 400 }
      );
    }

    // Validate role is valid
    const validRoles: UserRole[] = ["admin", "waiter"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Rol inválido. Roles permitidos: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // 3. Check permissions based on role hierarchy
    const creatorRole = currentUser.role as UserRole;
    const allowedRoles = ALLOWED_CREATIONS[creatorRole] || [];

    if (!allowedRoles.includes(role)) {
      // Provide specific error message based on the violation
      if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[creatorRole]) {
        return NextResponse.json(
          { error: "No puedes crear un usuario con un rol igual o superior al tuyo." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: `Tu rol (${creatorRole}) no tiene permiso para crear usuarios con rol ${role}.` },
        { status: 403 }
      );
    }

    // 4. Check if email already exists
    const existingUsers = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    const existingUser = Array.isArray(existingUsers) ? existingUsers[0] : null;

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este email." },
        { status: 400 }
      );
    }

    // 5. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 6. Create user in database
    const result = await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (${name}, ${email}, ${passwordHash}, ${role})
      RETURNING id, name, email, role, created_at
    `;

    const newUser = Array.isArray(result) ? result[0] : result;

    // 7. Return success response (without password_hash)
    return NextResponse.json(
      {
        message: "Usuario creado exitosamente",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          created_at: newUser.created_at,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
