"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  CreditCard,
  ChefHat,
  PartyPopper,
  PackageCheck,
  XCircle,
  Loader2,
  Bell,
  BellOff,
} from "lucide-react";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

type Status =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

interface TrackingData {
  ticketNumber: string;
  status: Status;
  total: number;
  items: { name: string; quantity: number; notes?: string }[];
}

/**
 * 5 pasos visibles al cliente:
 * Pedido recibido → Pagado → En preparación → Listo para recoger → Entregado
 *
 * Nota: al cobrar, el sistema avanza a PREPARING (cocina), pero en la
 * línea de tiempo "Pagado" queda marcado como hecho.
 */
const STEPS: { status: Status; label: string; icon: typeof CheckCircle2 }[] = [
  { status: "PENDING_PAYMENT", label: "Pedido recibido", icon: CheckCircle2 },
  { status: "PAID", label: "Pagado", icon: CreditCard },
  { status: "PREPARING", label: "En preparación", icon: ChefHat },
  { status: "READY", label: "Listo para recoger", icon: PartyPopper },
  { status: "COMPLETED", label: "Entregado", icon: PackageCheck },
];

function stepIndex(status: Status): number {
  const map: Record<string, number> = {
    PENDING_PAYMENT: 0,
    PAID: 1,
    PREPARING: 2,
    READY: 3,
    COMPLETED: 4,
  };
  return map[status] ?? 0;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.1;
    o.start();
    o.stop(ctx.currentTime + 0.2);
  } catch {
    /* ignore */
  }
}

function launchConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#7C3AED", "#EC4899", "#10B981", "#F59E0B", "#F1F5F9"];
  const pieces = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    r: 4 + Math.random() * 6,
    c: colors[Math.floor(Math.random() * colors.length)],
    vy: 2 + Math.random() * 4,
    vx: -2 + Math.random() * 4,
  }));
  let frame = 0;
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.r, p.r);
    });
    frame++;
    if (frame < 90) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}


function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn("SW register failed", e);
    return null;
  }
}

async function subscribeOrderPush(publicToken: string): Promise<boolean> {
  if (!("Notification" in window) || !("PushManager" in window)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await ensureServiceWorker();
  if (!reg) return false;

  const vapidRes = await fetch("/api/push/vapid");
  if (!vapidRes.ok) return false;
  const { publicKey } = await vapidRes.json();

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      publicToken,
      scope: "order",
    }),
  });
  return res.ok;
}


export default function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = usePromise(params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<"idle" | "on" | "denied" | "unsupported" | "error">("idle");
  const [pushBusy, setPushBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
    } else if (Notification.permission === "granted") {
      setPushStatus("on");
      // Re-suscribir por si cambió el token de pedido
      subscribeOrderPush(token).catch(() => {});
    } else if (Notification.permission === "denied") {
      setPushStatus("denied");
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/tracking/${token}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Pedido no encontrado");
        if (cancelled) return;

        if (
          prevStatus.current &&
          prevStatus.current !== "READY" &&
          json.status === "READY"
        ) {
          if (canvasRef.current) launchConfetti(canvasRef.current);
          playNotificationSound();
          if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification(`¡${json.ticketNumber} listo para recoger!`, {
                body: "Tu pedido está listo. Pasa a recogerlo.",
                tag: `order-ready-${json.ticketNumber}`,
              });
            } catch {
              /* ignore */
            }
          }
        }
        prevStatus.current = json.status;
        setData(json);
        setError(null);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error de conexión");
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-foreground px-6 text-center">
        <XCircle className="w-10 h-10 text-error" />
        <p className="text-error">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-foreground">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p>Buscando tu pedido…</p>
      </div>
    );
  }

  const isCancelled = data.status === "CANCELLED";
  const isReady = data.status === "READY";
  const isDelivered = data.status === "COMPLETED";
  const currentIdx = stepIndex(data.status);

  return (
    <div
      className={`min-h-screen text-base transition-colors duration-700 ${
        isReady || isDelivered
          ? "bg-success text-white"
          : "bg-background text-foreground"
      }`}
    >
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />

      <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center gap-6">
        <span className="text-sm uppercase tracking-widest opacity-70">
          Tu número de pedido
        </span>
        <span className="text-6xl font-black tracking-tight">
          {data.ticketNumber}
        </span>

        {data.status === "PENDING_PAYMENT" && !isCancelled && (
          <div className="w-full rounded-2xl border-2 border-warning bg-warning/15 px-5 py-5 text-center">
            <p className="text-base font-semibold text-warning leading-snug">
              ¡Casi listo! Solo falta pagar
            </p>
            <p className="text-4xl font-black text-foreground mt-3 tracking-tight">
              {data.ticketNumber}
            </p>
            <p className="text-sm text-foreground/80 mt-3 leading-relaxed">
              Acércate a la caja con tu número{" "}
              <strong className="text-foreground">{data.ticketNumber}</strong> para
              confirmar y pagar tu pedido. El cajero lo necesita para ubicar tu orden.
            </p>
          </div>
        )}

        {/* Activar notificaciones push */}
        {!isCancelled && !isDelivered && pushStatus !== "unsupported" && (
          <div className="w-full">
            {pushStatus === "on" ? (
              <p className="text-xs text-center text-foreground/50 flex items-center justify-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Te avisaremos cuando tu pedido esté listo
              </p>
            ) : pushStatus === "denied" ? (
              <p className="text-xs text-center text-foreground/50 flex items-center justify-center gap-1.5">
                <BellOff className="w-3.5 h-3.5" />
                Notificaciones bloqueadas en el navegador
              </p>
            ) : (
              <button
                type="button"
                disabled={pushBusy}
                onClick={async () => {
                  setPushBusy(true);
                  try {
                    const ok = await subscribeOrderPush(token);
                    setPushStatus(ok ? "on" : Notification.permission === "denied" ? "denied" : "error");
                  } catch {
                    setPushStatus("error");
                  } finally {
                    setPushBusy(false);
                  }
                }}
                className="w-full min-h-[48px] rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Bell className="w-4 h-4 text-primary" />
                {pushBusy ? "Activando…" : "Avísame cuando esté listo"}
              </button>
            )}
            {pushStatus === "error" && (
              <p className="text-xs text-center text-error mt-2">
                No se pudieron activar. Revisa la configuración del servidor (VAPID).
              </p>
            )}
          </div>
        )}

        {isCancelled ? (
          <div className="flex flex-col items-center gap-2 text-error">
            <XCircle className="w-12 h-12" />
            <p className="font-semibold">Este pedido fue cancelado.</p>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {isReady && !isDelivered && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-center"
                >
                  ¡Tu pedido está listo! 🎉
                </motion.p>
              )}
              {isDelivered && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-center"
                >
                  ¡Pedido entregado! Gracias
                </motion.p>
              )}
            </AnimatePresence>

            <div className="w-full flex flex-col gap-1 mt-4">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isDone = i <= currentIdx;
                const isCurrent = i === currentIdx && !isDelivered;
                return (
                  <div key={step.status} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                        transition={{
                          repeat: isCurrent ? Infinity : 0,
                          duration: 1.4,
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          isDone
                            ? "bg-white/20 border-white"
                            : "bg-transparent border-current opacity-40"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </motion.div>
                      {i < STEPS.length - 1 && (
                        <div className="w-0.5 h-8 bg-current opacity-20 relative overflow-hidden">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{
                              height: isDone && i < currentIdx ? "100%" : "0%",
                            }}
                            transition={{ duration: 0.6 }}
                            className="absolute top-0 left-0 w-full bg-current"
                          />
                        </div>
                      )}
                    </div>
                    <span className={`font-medium ${isDone ? "" : "opacity-40"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="w-full bg-card/50 border border-border rounded-xl p-4 mt-4">
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span>
                {item.quantity}× {item.name}
                {item.notes && (
                  <span className="opacity-60"> ({item.notes})</span>
                )}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-bold pt-2 mt-2 border-t border-border/50">
            <span>Total</span>
            <span>{formatCOP(data.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
