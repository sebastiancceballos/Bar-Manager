"use client";

import React, { useState, useEffect } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";

export const Onboarding: React.FC = () => {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenTour) {
      setRun(true);
    }
  }, []);

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

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("hasSeenOnboarding", "true");
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          primaryColor: "#7C3AED",
          backgroundColor: "#1E293B",
          textColor: "#F1F5F9",
          arrowColor: "#1E293B",
        },
      }}
    />
  );
};
