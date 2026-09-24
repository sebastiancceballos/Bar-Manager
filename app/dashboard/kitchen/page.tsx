"use client";

import { useI18n } from "@/app/i18n-provider";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Cocina quedó unificada en /dashboard/comandas. */
export default function KitchenRedirectPage() {
  const { t } = useI18n();

  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/comandas");
  }, [router]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      Redirigiendo a Comandas…
    </div>
  );
}
