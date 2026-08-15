import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { canAccessDashboardPath } from "@/lib/permissions";

// Runtime nodejs: jsonwebtoken usa crypto de Node (no disponible en Edge).
export const config = {
  matcher: ["/dashboard/:path*"],
  runtime: "nodejs",
};

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;
  const { pathname } = request.nextUrl;

  if (!payload) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Cocina unificada → Comandas
  if (pathname.startsWith("/dashboard/kitchen")) {
    return NextResponse.redirect(new URL("/dashboard/comandas", request.url));
  }

  if (!canAccessDashboardPath(payload.role, pathname)) {
    // Redirigir al home razonable según rol
    const fallback =
      payload.role === "owner"
        ? "/dashboard/owner"
        : payload.role === "cashier"
          ? "/dashboard/orders"
          : payload.role === "kitchen"
            ? "/dashboard/comandas"
            : payload.role === "waiter"
              ? "/dashboard/tables"
              : "/dashboard";
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  return NextResponse.next();
}
