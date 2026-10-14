"use client";

import { useAuth } from "@/app/providers";
import { roleLabel } from "@/lib/roles";
import { LocationSwitcher } from "@/app/components/LocationSwitcher";
import { LanguageToggle } from "@/app/components/LanguageToggle";
import { useI18n } from "@/app/i18n-provider";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
};

const MAX_VISIBLE_LINKS = 5;

export function Navigation() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [barName, setBarName] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

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
          // Reportes queda visible porque el tour de bienvenida lo resalta.
          {
            href: "/dashboard/reports",
            label: t("reports"),
            icon: BarChart3,
            className: "nav-reports",
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

  const visibleLinks = navLinks.slice(0, MAX_VISIBLE_LINKS);
  const overflowLinks = navLinks.slice(MAX_VISIBLE_LINKS);

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
  const overflowHasActive = overflowLinks.some((link) => isActive(link.href));

  return (
    <>
      <nav className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between gap-3 h-14 md:h-16">
            <Link
              href={isOwner ? "/dashboard/owner" : "/dashboard"}
              className="flex min-w-0 flex-shrink items-center gap-2 text-lg sm:text-xl font-bold text-primary"
            >
              <Beer className="w-6 h-6 flex-shrink-0" />
              <span className="hidden sm:inline truncate max-w-[10rem] lg:max-w-[14rem]">
                {isOwner ? "Bar Manager" : barName || "Bar Manager"}
              </span>
            </Link>

            <div className="flex items-center gap-0.5 sm:gap-1">
              <ul
                className={`items-center gap-0.5 sm:gap-1 ${showBottomNav ? "hidden md:flex" : "flex"}`}
              >
                {visibleLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        title={link.label}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-1.5 p-2 lg:px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-smooth ${link.className || ""} ${
                          active
                            ? "bg-primary/20 text-primary"
                            : "text-gray-400 hover:text-foreground hover:bg-card"
                        }`}
                      >
                        <Icon className="w-5 h-5 lg:w-4 lg:h-4" />
                        <span className="sr-only lg:not-sr-only">
                          {link.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-expanded={isMenuOpen}
                aria-controls="nav-overflow-menu"
                aria-label={isMenuOpen ? t("closeMenu") : t("openMenu")}
                title={t("more")}
                className={`relative ml-1 flex items-center gap-1.5 p-2 lg:px-3 rounded-lg text-sm font-medium border transition-smooth ${
                  isMenuOpen || overflowHasActive
                    ? "border-primary/40 bg-primary/20 text-primary"
                    : "border-border text-foreground hover:bg-card"
                }`}
              >
                {isMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
                <span className="hidden lg:inline">{t("more")}</span>
                {overflowHasActive && !isMenuOpen && (
                  <span
                    className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
              </button>
            </div>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  ref={menuRef}
                  id="nav-overflow-menu"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-sm max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-border bg-background/95 backdrop-blur shadow-2xl shadow-black/40"
                >
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {user?.name}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {user?.role
                          ? t(`role_${user.role}`, roleLabel(user.role))
                          : ""}
                      </p>
                    </div>
                  </div>

                  <ul className="p-2 space-y-0.5">
                    {/* En móvil sin bottom nav los 5 primeros ya están arriba;
                        con bottom nav se ocultan arriba, así que se listan aquí. */}
                    {(showBottomNav ? navLinks : overflowLinks).map((link) => {
                      const Icon = link.icon;
                      const active = isActive(link.href);
                      const isPrimary = visibleLinks.includes(link);
                      return (
                        <li
                          key={link.href}
                          className={isPrimary ? "md:hidden" : undefined}
                        >
                          <Link
                            href={link.href}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth ${
                              active
                                ? "bg-primary/20 text-primary"
                                : "text-gray-300 hover:text-foreground hover:bg-card"
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            {link.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="border-t border-border p-3 space-y-3">
                    <LocationSwitcher />
                    <LanguageToggle />
                  </div>

                  <div className="border-t border-border p-2 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("start-tour"));
                        setIsMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-smooth"
                    >
                      <HelpCircle className="w-5 h-5" />
                      {t("guide")}
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-error hover:bg-error/10 transition-smooth"
                    >
                      <LogOut className="w-5 h-5" />
                      {t("logout")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <Onboarding />
      </nav>

      {/* Bottom navigation — cajero (y mesero) en móvil */}
      {showBottomNav && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb"
          aria-label={t("quickNav")}
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
