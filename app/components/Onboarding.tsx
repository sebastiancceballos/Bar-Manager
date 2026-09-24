"use client";

import { useI18n } from "@/app/i18n-provider";

import React, { useState, useEffect } from "react";
import { Joyride, Step, STATUS } from "react-joyride";
import { useAuth } from "@/app/providers";

// Force default import if named import fails (common in some Next.js/CJS/ESM mixed environments)
const ReactJoyride = (Joyride as any) || Joyride;

export const Onboarding: React.FC = () => {
  const [run, setRun] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();
  const { t, locale } = useI18n();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // Solo escuchar el evento para inicio manual
    const handleManualStart = () => {
      setRun(false); // Reset para que pueda volver a empezar si ya estaba activo
      setTimeout(() => setRun(true), 100); // Re-run
    };

    window.addEventListener("start-tour", handleManualStart);
    
    // Limpieza al desmontar el componente
    return () => {
      window.removeEventListener("start-tour", handleManualStart);
    };
  }, []);

  // En mobile los enlaces .nav-tables/.nav-products/.nav-reports viven dentro
  // del menú hamburguesa (colapsado con display:none hasta que se abre), así
  // que Joyride no puede ubicarlos para el spotlight. En vez de un tour roto,
  // mostramos solo el mensaje de bienvenida con una nota para abrir el menú.
  const steps: Step[] = isMobile
    ? [
        {
          target: "body",
          content: t(
            "tourWelcomeMobile",
            "¡Bienvenido a Bar Manager! Toca el ícono ☰ arriba a la derecha para ver Mesas, Productos y Reportes en el menú."
          ),
          placement: "center",
        },
      ]
    : [
        {
          target: "body",
          content: t(
            "tourWelcome",
            "¡Bienvenido a Bar Manager! Vamos a darte un pequeño tour por las funciones principales."
          ),
          placement: "center",
        },
        {
          target: ".nav-tables",
          content: t(
            "tourTables",
            "Aquí puedes gestionar la posición y el orden de tus mesas, ademas ver el estado de las órdenes en tiempo real."
          ),
        },
        {
          target: ".nav-products",
          content: t(
            "tourProducts",
            "Desde aquí puedes administrar tu inventario y carta de productos."
          ),
        },
        {
          target: ".nav-reports",
          content: t(
            "tourReports",
            "Revisa tus ventas y el rendimiento de tu negocio con reportes detallados."
          ),
        },
      ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
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
        back: t("back", "Atrás"),
        close: t("close"),
        last: t("finish", "Finalizar"),
        next: t("next", "Siguiente"),
        skip: t("skipTour", "Saltar tour"),
      }}
    />
  );
};
