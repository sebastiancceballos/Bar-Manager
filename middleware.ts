import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { canAccessDashboardPath } from "@/lib/permissions";

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
  runtime: "nodejs",
};

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/self-service",
  "/api/tracking",
  "/api/cron",
  "/api/push/vapid",
];

function isPublicApi(path: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/")
  );
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;

  // --- API ---
  if (path.startsWith("/api/")) {
    if (isPublicApi(path)) {
      return NextResponse.next();
    }
    // must_change_password: bloquear APIs operativas
    if (payload?.mustChangePassword) {
      const allowed =
        path.startsWith("/api/auth/change-password") ||
        path.startsWith("/api/auth/me") ||
        path.startsWith("/api/auth/logout");
      if (!allowed) {
        return NextResponse.json(
          { error: "Debes cambiar tu contraseña", code: "MUST_CHANGE_PASSWORD" },
          { status: 403 }
        );
      }
    }
    return NextResponse.next();
  }

  // --- Dashboard ---
  if (payload?.mustChangePassword) {
    if (path !== "/dashboard/change-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/change-password";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!payload) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (path.startsWith("/dashboard/kitchen")) {
    return NextResponse.redirect(new URL("/dashboard/comandas", request.url));
  }

  if (!canAccessDashboardPath(payload.role, path)) {
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
