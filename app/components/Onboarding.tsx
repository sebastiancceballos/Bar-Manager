"use client";

import { useI18n } from "@/app/i18n-provider";

import React, { useState, useEffect, useCallback } from "react";
import { Joyride, Step, STATUS } from "react-joyride";
import { useAuth } from "@/app/providers";

// Force default import if named import fails (common in some Next.js/CJS/ESM mixed environments)
const ReactJoyride = (Joyride as any) || Joyride;

export type TourLink = { href: string; label: string };

type FeatureCopy = { key: string; fallback: string };

const FEATURE_COPY: Record<string, FeatureCopy> = {
  "/dashboard": {
    key: "tourDashboard",
    fallback:
      "Tu resumen del día: ventas, mesas ocupadas, comandas activas y alertas de stock bajo.",
  },
  "/dashboard/products": {
    key: "tourProducts",
    fallback:
      "Administra tu carta e inventario: precios, categorías, stock e historial de movimientos.",
  },
  "/dashboard/tables": {
    key: "tourTables",
    fallback:
      "Organiza el layout de tus mesas, abre órdenes, divide cuentas y cobra desde aquí.",
  },
  "/dashboard/comandas": {
    key: "tourComandas",
    fallback:
      "Mesas y autoservicio en un solo panel, actualizado en vivo para cocina y barra.",
  },
  "/dashboard/reports": {
    key: "tourReports",
    fallback:
      "Revisa ventas, productos más vendidos y exporta reportes diarios o por rango de fechas.",
  },
  "/dashboard/caja": {
    key: "tourCash",
    fallback:
      "Abre y cierra caja, registra el efectivo y cuadra los cobros de tu turno.",
  },
  "/dashboard/orders": {
    key: "tourSelfService",
    fallback:
      "Pedidos que tus clientes hacen desde el QR de autoservicio. Acéptalos y sigue su estado.",
  },
  "/dashboard/reservas": {
    key: "tourReservations",
    fallback: "Agenda y gestiona las reservas de mesas de tus clientes.",
  },
  "/dashboard/auditoria": {
    key: "tourAudit",
    fallback:
      "Registro de acciones sensibles: cobros, descuentos, movimientos de caja y cambios de usuarios.",
  },
  "/dashboard/turno": {
    key: "tourMyShift",
    fallback: "Marca el inicio y fin de tu turno y revisa tus horas trabajadas.",
  },
  "/dashboard/historial": {
    key: "tourHistory",
    fallback: "Consulta las órdenes ya cobradas y reimprime tickets.",
  },
  "/dashboard/owner": {
    key: "tourOwnerPanel",
    fallback: "Vista global de todos los negocios y sus ventas.",
  },
  "/dashboard/organizations": {
    key: "tourOrganizations",
    fallback:
      "Da de alta clientes: crea la organización, sus sucursales y el administrador del negocio.",
  },
  "/dashboard/bars": {
    key: "tourBars",
    fallback: "Gestiona las sucursales (bares) de cada organización.",
  },
  "/dashboard/users": {
    key: "tourUsers",
    fallback: "Crea usuarios y asigna roles: administrador, cajero, mesero o cocina.",
  },
};

function findVisible(selector: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  for (const node of Array.from(nodes)) {
    if (node.getClientRects().length > 0) return node;
  }
  return null;
}

export const Onboarding: React.FC<{ links: TourLink[] }> = ({ links }) => {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const { user } = useAuth();
  const { t } = useI18n();

  const buildSteps = useCallback((): Step[] => {
    const role = user?.role ?? "waiter";
    const result: Step[] = [
      {
        target: "body",
        placement: "center",
        content: t(
          `tourWelcome_${role}`,
          t(
            "tourWelcome",
            "¡Bienvenido a Bar Manager! Te mostramos las funciones principales."
          )
        ),
      },
    ];

    const hidden: TourLink[] = [];
    for (const link of links) {
      const copy = FEATURE_COPY[link.href];
      const el = findVisible(`[data-tour="nav:${link.href}"]`);
      if (!el) {
        hidden.push(link);
        continue;
      }
      result.push({
        target: el,
        title: link.label,
        content: copy ? t(copy.key, copy.fallback) : link.label,
      });
    }

    const menuButton = findVisible('[data-tour="more-menu"]');
    if (menuButton) {
      const hiddenList = hidden.map((l) => l.label).join(", ");
      result.push({
        target: menuButton,
        title: t("more", "Más"),
        content: (
          <div className="space-y-2">
            {hiddenList && (
              <p>
                {t("tourMoreMenuLinks", "Aquí encontrarás también:")}{" "}
                <strong>{hiddenList}</strong>.
              </p>
            )}
            <p>
              {t(
                "tourMoreMenu",
                "En este menú puedes cambiar de sucursal, cambiar el idioma (ES/EN), volver a ver esta guía y cerrar sesión."
              )}
            </p>
          </div>
        ),
      });
    }

    result.push({
      target: "body",
      placement: "center",
      content: t(
        "tourDone",
        "¡Listo! Puedes repetir esta guía cuando quieras desde el menú › Ver guía."
      ),
    });

    return result;
  }, [links, t, user?.role]);

  useEffect(() => {
    const handleManualStart = () => {
      setRun(false);
      // Wait for the overflow menu to close so spotlight targets are measured correctly.
      setTimeout(() => {
        setSteps(buildSteps());
        setRun(true);
      }, 250);
    };

    window.addEventListener("start-tour", handleManualStart);
    return () => window.removeEventListener("start-tour", handleManualStart);
  }, [buildSteps]);

  const handleJoyrideCallback = (data: any) => {
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(data.status)) {
      setRun(false);
    }
  };

  return (
    <ReactJoyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      disableScrolling={false}
      disableScrollParentFix={false}
      spotlightPadding={6}
      styles={{
        options: {
          primaryColor: "#7C3AED",
          backgroundColor: "#1E293B",
          textColor: "#F1F5F9",
          arrowColor: "#1E293B",
          zIndex: 1000,
        },
        tooltipContainer: {
          textAlign: "left",
        },
        tooltipTitle: {
          fontSize: "1rem",
          fontWeight: 700,
        },
        buttonNext: {
          padding: "10px 20px",
          borderRadius: "8px",
        },
        buttonBack: {
          marginRight: "10px",
        },
      }}
      locale={{
        back: t("back", "Atrás"),
        close: t("close"),
        last: t("finish", "Finalizar"),
        next: t("next", "Siguiente"),
        skip: t("skipTour", "Saltar tour"),
      }}
    />
  );
};
