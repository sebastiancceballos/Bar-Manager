"use client";

import { useI18n } from "@/app/i18n-provider";
import { fmtDate, fmtTime } from "@/lib/format-date";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";

interface Shift {
  id: number;
  clock_in: string;
  clock_out: string | null;
}

function formatDuration(start: string, end: string | null | undefined, calculatingLabel: string) {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  if (ms < 0) return calculatingLabel;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours === 0) return `${mins}min`;
  return `${hours}h ${mins}min`;
}

export default function TurnoPage() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [, setTick] = useState(0);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/shifts");
      if (res.ok) {
        const data = await res.json();
        setOpen(data.open);
        setHistory(data.history || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const handleToggle = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/shifts", { method: "POST" });
      if (res.ok) fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("shiftTitle")}</h1>
            <p className="text-sm text-gray-400 mt-1">{t("clockIn")}</p>
          </div>

          {loading ? (
            <div className="card animate-pulse h-32" />
          ) : (
            <div className="card text-center space-y-4">
              {open ? (
                <>
                  <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-success/10 text-success">{t("activeShift")}</span>
                  <p className="text-4xl font-bold text-foreground">{formatDuration(open.clock_in, null, t("calculating"))}</p>
                  <p className="text-sm text-gray-400">
                    {t("clockInTime")}: {fmtTime(open.clock_in, locale)}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-gray-700/30 text-gray-400">{t("noActiveShift")}</span>
                  <p className="text-gray-400">{t("notClockedInToday")}</p>
                </>
              )}
              <button
                onClick={handleToggle}
                disabled={submitting}
                className={`btn w-full disabled:opacity-50 ${open ? "bg-error/10 text-error" : "btn-primary"}`}
              >
                {submitting ? "..." : open ? t("markExit") : t("markEntry")}
              </button>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">{t("recentShifts")}</h2>
              <div className="space-y-2">
                {history.map((s) => (
                  <div key={s.id} className="card-sm flex justify-between text-sm">
                    <span>{fmtDate(s.clock_in, locale)}</span>
                    <span className="text-gray-400">
                      {fmtTime(s.clock_in, locale, { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {s.clock_out ? fmtTime(s.clock_out, locale, { hour: "2-digit", minute: "2-digit" }) : "?"}
                    </span>
                    <span className="font-medium">{formatDuration(s.clock_in, s.clock_out, t("calculating"))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}