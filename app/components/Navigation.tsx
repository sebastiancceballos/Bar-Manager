"use client";

import { useAuth } from "@/app/providers";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [barName, setBarName] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) return;
    fetch("/api/locations/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.name) setBarName(d.name); })
      .catch(() => { });
  }, [user]);

  return (
    <nav className="glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold text-primary">
            {barName || "Bar Manager"}
          </Link>
          <div className="flex gap-6">
            {isAdmin && (
              <>
                <Link
                  href="/dashboard"
                  className={`transition-smooth ${pathname === "/dashboard"
                      ? "text-primary"
                      : "text-gray-400 hover:text-foreground"
                    }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/products"
                  className={`transition-smooth ${pathname === "/dashboard/products"
                      ? "text-primary"
                      : "text-gray-400 hover:text-foreground"
                    }`}
                >
                  Productos
                </Link>
                <Link
                  href="/dashboard/tables"
                  className={`transition-smooth ${pathname === "/dashboard/tables"
                      ? "text-primary"
                      : "text-gray-400 hover:text-foreground"
                    }`}
                >
                  Mesas
                </Link>
                <Link
                  href="/dashboard/reports"
                  className={`transition-smooth ${pathname === "/dashboard/reports"
                      ? "text-primary"
                      : "text-gray-400 hover:text-foreground"
                    }`}
                >
                  Reportes
                </Link>
              </>
            )}
            {!isAdmin && (
              <Link
                href="/dashboard/tables"
                className={`transition-smooth ${pathname === "/dashboard/tables"
                    ? "text-primary"
                    : "text-gray-400 hover:text-foreground"
                  }`}
              >
                Mesas
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="btn btn-outline btn-sm"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>
  );
}