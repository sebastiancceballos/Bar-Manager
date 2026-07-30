import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// Runtime nodejs: jsonwebtoken usa crypto de Node (no disponible en Edge).
export const config = {
  matcher: ["/dashboard/orders/:path*", "/dashboard/kitchen/:path*"],
  runtime: "nodejs",
};

const ROUTE_ROLES: { prefix: string; roles: string[] }[] = [
  { prefix: "/dashboard/orders", roles: ["owner", "admin", "cashier"] },
  // /dashboard/kitchen se redirige a comandas; roles legacy kitchen siguen pudiendo entrar
  { prefix: "/dashboard/kitchen", roles: ["owner", "admin", "kitchen", "waiter"] },
];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Cocina unificada en Comandas
  if (request.nextUrl.pathname.startsWith("/dashboard/kitchen")) {
    return NextResponse.redirect(new URL("/dashboard/comandas", request.url));
  }

  const rule = ROUTE_ROLES.find((r) => request.nextUrl.pathname.startsWith(r.prefix));
  if (rule && !rule.roles.includes(payload.role)) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}
