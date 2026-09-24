"use client";

import { useAuth } from "@/app/providers";
import { roleLabel } from "@/lib/roles";
import { LocationSwitcher } from "@/app/components/LocationSwitcher";
import { LanguageToggle } from "@/app/components/LanguageToggle";
import { useI18n } from "@/app/i18n-provider";
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
  Building2,
  History,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
};

export function Navigation() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
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
  const isWaiter = user?.role === "waiter";

  useEffect(() => {
    if (!user || isOwner) return;
    fetch("/api/locations/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.name) setBarName(d.name);
      })
      .catch(() => {});
  }, [user, isOwner]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const navLinks: NavLink[] = [
    ...(isOwner
      ? [
          { href: "/dashboard/owner", label: t("panel"), icon: LayoutDashboard },
          {
            href: "/dashboard/organizations",
            label: t("organizations"),
            icon: Building2,
          },
          { href: "/dashboard/bars", label: t("bars"), icon: Beer },
          { href: "/dashboard/users", label: t("users"), icon: Users },
        ]
      : []),
    ...(isAdmin
      ? [
          { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
          {
            href: "/dashboard/products",
            label: t("products"),
            icon: Package,
            className: "nav-products",
          },
          {
            href: "/dashboard/tables",
            label: t("tables"),
            icon: TableProperties,
            className: "nav-tables",
          },
          {
            href: "/dashboard/comandas",
            label: t("comandas"),
            icon: ClipboardList,
            className: "nav-comandas",
          },
          { href: "/dashboard/caja", label: t("cash"), icon: Wallet },
          {
            href: "/dashboard/orders",
            label: t("selfServiceOrders"),
            icon: Receipt,
          },
          {
            href: "/dashboard/reservas",
            label: t("reservations"),
            icon: CalendarClock,
          },
          {
            href: "/dashboard/reports",
            label: t("reports"),
            icon: BarChart3,
            className: "nav-reports",
          },
          {
            href: "/dashboard/auditoria",
            label: t("audit"),
            icon: ShieldCheck,
          },
          { href: "/dashboard/turno", label: t("myShift"), icon: Clock },
        ]
      : []),
    ...(isCashier
      ? [
          {
            href: "/dashboard/tables",
            label: t("tables"),
            icon: TableProperties,
          },
          {
            href: "/dashboard/comandas",
            label: t("comandas"),
            icon: ClipboardList,
          },
          {
            href: "/dashboard/orders",
            label: t("orders"),
            icon: Receipt,
          },
          { href: "/dashboard/caja", label: t("cash"), icon: Wallet },
          {
            href: "/dashboard/historial",
            label: t("history"),
            icon: History,
          },
          { href: "/dashboard/turno", label: t("myShift"), icon: Clock },
        ]
      : []),
    ...(isKitchen
      ? [
          {
            href: "/dashboard/comandas",
            label: t("comandas"),
            icon: ClipboardList,
          },
          { href: "/dashboard/turno", label: t("myShift"), icon: Clock },
        ]
      : []),
    ...(!isAdmin && !isOwner && !isCashier && !isKitchen
      ? [
          {
            href: "/dashboard/tables",
            label: t("tables"),
            icon: TableProperties,
          },
          {
            href: "/dashboard/comandas",
            label: t("comandas"),
            icon: ClipboardList,
          },
          {
            href: "/dashboard/reservas",
            label: t("reservations"),
            icon: CalendarClock,
          },
          { href: "/dashboard/turno", label: t("myShift"), icon: Clock },
        ]
      : []),
  ];

  /** Accesos rápidos en barra inferior (móvil) */
  const bottomLinks: NavLink[] = isCashier
    ? [
        { href: "/dashboard/tables", label: t("tables"), icon: TableProperties },
        {
          href: "/dashboard/comandas",
          label: t("comandas"),
          icon: ClipboardList,
        },
        { href: "/dashboard/orders", label: t("orders"), icon: Receipt },
        { href: "/dashboard/caja", label: t("cash"), icon: Wallet },
        {
          href: "/dashboard/historial",
          label: t("history"),
          icon: History,
        },
      ]
    : isWaiter
      ? [
          { href: "/dashboard/tables", label: t("tables"), icon: TableProperties },
          {
            href: "/dashboard/comandas",
            label: t("comandas"),
            icon: ClipboardList,
          },
          { href: "/dashboard/turno", label: t("myShift"), icon: Clock },
        ]
      : [];

  const showBottomNav = bottomLinks.length > 0;
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <>
      <nav className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex-shrink-0 flex items-center">
              <Link
                href={isOwner ? "/dashboard/owner" : "/dashboard"}
                className="flex items-center gap-2 text-xl font-bold text-primary"
              >
                <Beer className="w-6 h-6" />
                <span className="hidden sm:inline">
                  {isOwner ? "Bar Manager" : barName || "Bar Manager"}
                </span>
                <span className="sm:hidden">
                  {isOwner
                    ? "BarMgr"
                    : barName?.split(" ")[0] || "BarMgr"}
                </span>
              </Link>
            </div>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2 flex-wrap justify-end">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-smooth ${link.className || ""} ${
                      isActive(link.href)
                        ? "bg-primary/20 text-primary"
                        : "text-gray-400 hover:text-foreground hover:bg-card"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{link.label}</span>
                  </Link>
                );
              })}
              <div className="ml-2">
                <LocationSwitcher />
              </div>
              <LanguageToggle className="ml-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-error hover:bg-error/10"
                title={t("logout")}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile: menú hamburguesa (siempre; bottom nav es atajo) */}
            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMenuOpen((v) => !v)}
                className="p-2 rounded-lg text-foreground hover:bg-card"
                aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden glass border-t border-border overflow-hidden"
            >
              <div className="px-3 pt-2 pb-3 space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium ${link.className || ""} ${
                        isActive(link.href)
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
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-foreground">
                      {user?.name}
                    </div>
                    <div className="text-sm font-medium text-gray-400">
                      {roleLabel(user?.role)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 px-5">
                  <LocationSwitcher />
                </div>
                <div className="mt-3 px-5">
                  <LanguageToggle />
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

      {/* Bottom navigation — cajero (y mesero) en móvil */}
      {showBottomNav && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb"
          aria-label="Navegación rápida"
        >
          <div className="flex items-stretch justify-around max-w-lg mx-auto">
            {bottomLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors ${
                    active
                      ? "text-primary"
                      : "text-gray-400 active:text-foreground"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${active ? "text-primary" : ""}`}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Espacio para que el contenido no quede bajo la barra */}
      {showBottomNav && (
        <div className="md:hidden h-[calc(3.5rem+env(safe-area-inset-bottom))]" aria-hidden />
      )}
    </>
  );
}
