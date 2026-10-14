"use client";

import { useI18n } from "@/app/i18n-provider";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
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
        <div className="text-foreground">{t("loading")}</div>
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
  const { t } = useI18n();

  if (isLoading) return null;
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-error">{t("noPermission")}</div>
      </div>
    );
  }

  return children;
}
