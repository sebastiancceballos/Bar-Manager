"use client";

import { useI18n } from "@/app/i18n-provider";
import { fmtDateTime } from "@/lib/format-date";

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

export default function AuditoriaPage() {
  const { t, locale } = useI18n();
  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      close_order: t("actionOrderClosed"),
      order_closed: t("actionOrderClosed"),
      "order.closed": t("actionOrderClosed"),
      transfer_order: t("actionTransferOrder"),
      open_cash_session: t("actionOpenCashSession"),
      close_cash_session: t("actionCashClosed"),
      cash_session_closed: t("actionCashClosed"),
      reset_password: t("actionResetPassword"),
      delete_user: t("actionDeleteUser"),
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
          <h1 className="text-3xl font-bold text-foreground mb-1">{t("auditLogTitle")}</h1>
          <p className="text-sm text-gray-400 mb-6">{t("auditSubtitle")}</p>

          {loading ? (
            <div className="card animate-pulse h-40" />
          ) : entries.length === 0 ? (
            <div className="card text-center text-gray-400 py-12">{t("noRecordsYet")}</div>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className="card-sm flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{actionLabel(e.action)}</p>
                    <p className="text-xs text-gray-500 mt-1 break-words">{e.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-400">{e.user_name || t("systemUser")}</p>
                    <p className="text-xs text-gray-500">{fmtDateTime(e.created_at, locale)}</p>
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
