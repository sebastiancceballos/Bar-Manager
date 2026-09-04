"use client";

import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-error">No tienes permiso para acceder aquí</div>
      </div>
    );
  }

  return children;
}
