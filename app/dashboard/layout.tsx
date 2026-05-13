"use client";

import { useAuth } from "@/app/providers";
import { Beer } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <Beer className="w-12 h-12 text-primary animate-bounce" />
          <div className="absolute inset-0 w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
        <div className="text-foreground font-medium animate-pulse">Iniciando sesión...</div>
      </div>
    );
  }

  // Si no hay usuario, el ProtectedLayout dentro de las páginas se encargará del redirect.
  // Aquí solo nos aseguramos de no bloquear el renderizado si ya terminó de cargar.
  return <>{children}</>;
}
