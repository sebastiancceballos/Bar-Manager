"use client";

import { useAuth } from "@/app/providers";
import { roleLabel } from "@/lib/roles";
import { LocationSwitcher } from "@/app/components/LocationSwitcher";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Onboarding } from "./Onboarding";
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Package, 
  TableProperties, 
  BarChart3, 
  Users, 
  LogOut,
  Beer,
  HelpCircle,
  ClipboardList,
  Wallet,
  CalendarClock,
  ShieldCheck,
  Clock,
  Receipt,
  Building2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [barName, setBarName] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "owner";
  const isCashier = user?.role === "cashier";
  const isKitchen = user?.role === "kitchen";

  useEffect(() => {
    if (!user || isOwner) return;
    fetch("/api/locations/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.name) setBarName(d.name); })
      .catch(() => { });
  }, [user, isOwner]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    ...(isOwner ? [
      { href: "/dashboard/owner", label: "Panel", icon: LayoutDashboard },
      { href: "/dashboard/organizations", label: "Organizaciones", icon: Building2 },
      { href: "/dashboard/bars", label: "Bares", icon: Beer },
      { href: "/dashboard/users", label: "Usuarios", icon: Users },
    ] : []),
    ...(isAdmin ? [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/products", label: "Productos", icon: Package, className: "nav-products" },
      { href: "/dashboard/tables", label: "Mesas", icon: TableProperties, className: "nav-tables" },
      { href: "/dashboard/comandas", label: "Comandas", icon: ClipboardList, className: "nav-comandas" },
      { href: "/dashboard/caja", label: "Caja", icon: Wallet },
      { href: "/dashboard/orders", label: "Pedidos autoservicio", icon: Receipt },
      { href: "/dashboard/reservas", label: "Reservas", icon: CalendarClock },
      { href: "/dashboard/reports", label: "Reportes", icon: BarChart3, className: "nav-reports" },
      { href: "/dashboard/auditoria", label: "Auditoría", icon: ShieldCheck },
      { href: "/dashboard/turno", label: "Mi Turno", icon: Clock },
    ] : []),
    ...(isCashier ? [
      { href: "/dashboard/tables", label: "Mesas", icon: TableProperties },
      { href: "/dashboard/comandas", label: "Comandas", icon: ClipboardList },
      { href: "/dashboard/orders", label: "Pedidos autoservicio", icon: Receipt },
      { href: "/dashboard/caja", label: "Caja", icon: Wallet },
      { href: "/dashboard/turno", label: "Mi Turno", icon: Clock },
    ] : []),
    ...(isKitchen ? [
      { href: "/dashboard/comandas", label: "Comandas", icon: ClipboardList },
      { href: "/dashboard/turno", label: "Mi Turno", icon: Clock },
    ] : []),
    ...(!isAdmin && !isOwner && !isCashier && !isKitchen ? [
      { href: "/dashboard/tables", label: "Mesas", icon: TableProperties },
      { href: "/dashboard/comandas", label: "Comandas", icon: ClipboardList },
      { href: "/dashboard/reservas", label: "Reservas", icon: CalendarClock },
      { href: "/dashboard/turno", label: "Mi Turno", icon: Clock },
    ] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 glass border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link 
              href={isOwner ? "/dashboard/owner" : "/dashboard"} 
              className="flex items-center gap-2 text-xl font-bold text-primary"
            >
              <Beer className="w-6 h-6" />
              <span className="hidden sm:inline">{isOwner ? "Bar Manager" : (barName || "Bar Manager")}</span>
              <span className="sm:hidden">{isOwner ? "BarMgr" : (barName?.split(' ')[0] || "BarMgr")}</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-baseline space-x-4">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-smooth ${link.className || ""} ${
                      pathname === link.href 
                        ? "bg-primary/10 text-primary" 
                        : "text-gray-400 hover:text-foreground hover:bg-card"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
            
            <div className="ml-4 pl-4 border-l border-border flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-foreground">{user?.name}</span>
                <span className="text-[10px] text-gray-500 tracking-wider">{roleLabel(user?.role)}</span>
                <LocationSwitcher />
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("start-tour"))}
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full transition-smooth"
                title="Ver Guía del Sistema"
              >
                <HelpCircle size={20} className="text-primary/60 hover:text-primary" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-error hover:bg-error/10 rounded-full transition-smooth"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-foreground hover:bg-card focus:outline-none transition-smooth"
            >
              <span className="sr-only">Abrir menú</span>
              {isMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium ${link.className || ""} ${
                      pathname === link.href 
                        ? "bg-primary/20 text-primary shadow-lg shadow-primary/10" 
                        : "text-gray-400 hover:text-foreground hover:bg-card"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
            
            <div className="pt-4 pb-3 border-t border-border">
              <div className="flex items-center px-5">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {user?.name?.[0].toUpperCase()}
                  </div>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-foreground">{user?.name}</div>
                  <div className="text-sm font-medium text-gray-400">{roleLabel(user?.role)}</div>
                </div>
              </div>
              <div className="mt-3 px-2">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("start-tour"));
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-primary hover:bg-primary/10 transition-smooth"
                >
                  <HelpCircle className="w-5 h-5" />
                  Ver Guía
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-error hover:bg-error/10 transition-smooth"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Onboarding />
    </nav>
  );
}