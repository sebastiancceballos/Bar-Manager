import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// Requiere runtime "nodejs" (estable desde Next 15.2) porque jsonwebtoken
// usa el módulo `crypto` de Node, que no está disponible en el runtime Edge
// por defecto de los middlewares.
export const config = {
  matcher: ["/dashboard/orders/:path*", "/dashboard/kitchen/:path*"],
  runtime: "nodejs",
};

const ROUTE_ROLES: { prefix: string; roles: string[] }[] = [
  { prefix: "/dashboard/orders", roles: ["owner", "admin", "cashier"] },
  { prefix: "/dashboard/kitchen", roles: ["owner", "admin", "kitchen"] },
];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const rule = ROUTE_ROLES.find((r) => request.nextUrl.pathname.startsWith(r.prefix));
  if (rule && !rule.roles.includes(payload.role)) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}
