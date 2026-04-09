import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./auth";

export async function authMiddleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized - No token" },
      { status: 401 }
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Unauthorized - Invalid token" },
      { status: 401 }
    );
  }

  // Store user info in request headers for use in route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-email", payload.email);

  return {
    isValid: true,
    payload,
    headers: requestHeaders,
  };
}

export function requireRole(
  requiredRole: "admin" | "waiter" | ("admin" | "waiter")[]
) {
  return (userRole: string) => {
    const roles = Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole];
    return roles.includes(userRole as "admin" | "waiter");
  };
}
