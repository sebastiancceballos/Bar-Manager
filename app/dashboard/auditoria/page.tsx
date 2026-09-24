"use client";

import { useI18n } from "@/app/i18n-provider";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";

interface AuditEntry {
  id: number;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  close_order: "Cobró/cerró una orden",
  transfer_order: "Transfirió una orden de mesa",
  open_cash_session: "Abrió turno de caja",
  close_cash_session: "Cerró turno de caja",
  reset_password: "Restableció una contraseña",
  delete_user: "Eliminó un usuario",
};

export default function AuditoriaPage() {
  const { t } = useI18n();
  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      order_closed: t("actionOrderClosed"),
      "order.closed": t("actionOrderClosed"),
      cash_session_closed: t("actionCashClosed"),
      self_service_order_created: t("actionSelfServiceCreated"),
    };
    return map[action] || action.replace(/_/g, " ");
  };

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit-log")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">Bitácora de Auditoría</h1>
          <p className="text-sm text-gray-400 mb-6">{t("auditSubtitle")}</p>

          {loading ? (
            <div className="card animate-pulse h-40" />
          ) : entries.length === 0 ? (
            <div className="card text-center text-gray-400 py-12">Sin registros todavía</div>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className="card-sm flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{ACTION_LABELS[e.action] || e.action}</p>
                    <p className="text-xs text-gray-500 mt-1 break-words">{e.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-400">{e.user_name || "Sistema"}</p>
                    <p className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString("es-CO")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
