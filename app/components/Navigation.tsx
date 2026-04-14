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
  const isOwner = user?.role === "owner";

  useEffect(() => {
    if (!user || isOwner) return;
    fetch("/api/locations/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.name) setBarName(d.name); })
      .catch(() => { });
  }, [user, isOwner]);

  return (
    <nav className="glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href={isOwner ? "/dashboard/owner" : "/dashboard"} className="text-xl font-bold text-primary">
            {isOwner ? "Bar Manager" : (barName || "Bar Manager")}
          </Link>
          <div className="flex gap-6">
            {isOwner && (
              <>
                <Link href="/dashboard/owner" className={`transition-smooth ${pathname === "/dashboard/owner" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Panel</Link>
                <Link href="/dashboard/bars" className={`transition-smooth ${pathname === "/dashboard/bars" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Bares</Link>
                <Link href="/dashboard/users" className={`transition-smooth ${pathname === "/dashboard/users" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Usuarios</Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link href="/dashboard" className={`transition-smooth ${pathname === "/dashboard" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Dashboard</Link>
                <Link href="/dashboard/products" className={`transition-smooth ${pathname === "/dashboard/products" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Productos</Link>
                <Link href="/dashboard/tables" className={`transition-smooth ${pathname === "/dashboard/tables" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Mesas</Link>
                <Link href="/dashboard/reports" className={`transition-smooth ${pathname === "/dashboard/reports" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Reportes</Link>
              </>
            )}
            {!isAdmin && !isOwner && (
              <Link href="/dashboard/tables" className={`transition-smooth ${pathname === "/dashboard/tables" ? "text-primary" : "text-gray-400 hover:text-foreground"}`}>Mesas</Link>
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