import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// IMPORTANTE: este chequeo se hace DENTRO de las funciones (no a nivel de
// módulo). Si estuviera fuera, un JWT_SECRET faltante tumbaría el archivo
// completo apenas Next.js lo importa, antes de que cualquier try/catch de
// una ruta pudiera atraparlo — y el usuario vería una página de error HTML
// en vez de un JSON, rompiendo el fetch() del frontend.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está configurado. Añádelo en las variables de entorno del servidor (Vercel → Settings → Environment Variables) y vuelve a desplegar."
    );
  }
  return secret;
}

const TOKEN_EXPIRY = "7d";

export type UserRole = "owner" | "admin" | "waiter";

export interface JWTPayload {
  id: number;
  email: string;
  role: UserRole;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("auth-token")?.value;
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  const token = await getAuthCookie();
  if (!token) return null;
  return verifyToken(token);
}
