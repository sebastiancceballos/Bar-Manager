"use client";

import React, { useState, useEffect } from "react";
import { Joyride, Step, STATUS } from "react-joyride";
import { useAuth } from "@/app/providers";

// Force default import if named import fails (common in some Next.js/CJS/ESM mixed environments)
const ReactJoyride = (Joyride as any) || Joyride;

export const Onboarding: React.FC = () => {
  const [run, setRun] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    // Only show to admins/owners and only on the main dashboard path
    const isAdminOrOwner = user?.role === "admin" || user?.role === "owner";
    const isMainDashboard = window.location.pathname === "/dashboard";
    const hasSeenTour = localStorage.getItem("hasSeenOnboarding");
    
    if (isAdminOrOwner && isMainDashboard && !hasSeenTour) {
      setRun(true);
    }
  }, [user]);

  const steps: Step[] = [
    {
      target: "body",
      content: "¡Bienvenido a Bar Manager! Vamos a darte un pequeño tour por las funciones principales.",
      placement: "center",
    },
    {
      target: ".nav-tables",
      content: "Aquí puedes gestionar el layout de tus mesas y ver el estado de las órdenes en tiempo real.",
    },
    {
      target: ".nav-products",
      content: "Desde aquí puedes administrar tu inventario y carta de productos.",
    },
    {
      target: ".nav-reports",
      content: "Revisa tus ventas y el rendimiento de tu negocio con reportes detallados.",
    },
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("hasSeenOnboarding", "true");
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
      spotlightPadding={10}
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
        buttonNext: {
          padding: "10px 20px",
          borderRadius: "8px",
        },
        buttonBack: {
          marginRight: "10px",
        },
      }}
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        skip: "Saltar tour",
      }}
    />
  );
};
