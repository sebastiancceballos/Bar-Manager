"use client";

import { useEffect, useRef } from "react";

/**
 * setInterval que solo corre cuando la pestaña está visible.
 * Reduce tráfico (polling) y riesgo de bloqueo por rate/DDoS cuando
 * una tablet deja Comandas/Mesas abiertas en segundo plano.
 */
export function useVisibleInterval(
  callback: () => void,
  ms: number,
  enabled = true
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || ms <= 0) return;

    let id: ReturnType<typeof setInterval> | null = null;

    const clear = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };

    const start = () => {
      clear();
      id = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        cbRef.current();
      }, ms);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        cbRef.current(); // refresh al volver
        start();
      } else {
        clear();
      }
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}
