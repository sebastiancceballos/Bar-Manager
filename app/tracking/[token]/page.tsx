"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CreditCard, ChefHat, PartyPopper, XCircle, Loader2 } from "lucide-react";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

type Status = "PENDING_PAYMENT" | "PAID" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

interface TrackingData {
  ticketNumber: string;
  status: Status;
  total: number;
  clientName?: string;
  items: { name: string; quantity: number; notes?: string }[];
}

const STEPS: { status: Status; label: string; icon: typeof CheckCircle2 }[] = [
  { status: "PENDING_PAYMENT", label: "Pedido recibido", icon: CheckCircle2 },
  { status: "PAID", label: "Pagado", icon: CreditCard },
  { status: "PREPARING", label: "En preparación", icon: ChefHat },
  { status: "READY", label: "Listo para recoger", icon: PartyPopper },
];

function stepIndex(status: Status) {
  const idx = STEPS.findIndex((s) => s.status === status);
  return idx === -1 ? (status === "COMPLETED" ? STEPS.length - 1 : 0) : idx;
}

// Confeti ligero hecho a mano con <canvas> — evita depender de una librería
// externa solo para este efecto puntual.
function launchConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#7C3AED", "#EC4899", "#10B981", "#F59E0B", "#F1F5F9"];
  const particles = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    r: 4 + Math.random() * 5,
    vy: 2 + Math.random() * 3,
    vx: -2 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vrot: -0.2 + Math.random() * 0.4,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  let frame = 0;
  let raf: number;
  function tick() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx!.restore();
    }
    if (frame < 180) {
      raf = requestAnimationFrame(tick);
    } else {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  tick();
  return () => cancelAnimationFrame(raf);
}

// Sonido de notificación corto generado con Web Audio (sin archivo externo)
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const notes = [880, 1108];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  } catch {
    // Si el navegador bloquea audio sin interacción previa, simplemente no suena
  }
}

export default function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevStatus = useRef<Status | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/tracking/${token}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Pedido no encontrado");
        if (cancelled) return;

        if (prevStatus.current && prevStatus.current !== "READY" && json.status === "READY") {
          if (canvasRef.current) launchConfetti(canvasRef.current);
          playNotificationSound();
          if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        }
        prevStatus.current = json.status;
        setData(json);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error de conexión");
      }
    }

    poll();
    const interval = setInterval(poll, 4000); // polling simple, ideal para Vercel serverless
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
  const currentIdx = stepIndex(data.status);

  return (
    <div
      className={`min-h-screen text-base transition-colors duration-700 ${
        isReady ? "bg-success text-white" : "bg-background text-foreground"
      }`}
    >
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />

      <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center gap-6">
        <span className="text-sm uppercase tracking-widest opacity-70">Tu ficho</span>
        <span className="text-6xl font-black tracking-tight">{data.ticketNumber}</span>

        {data.status === "PENDING_PAYMENT" && !isCancelled && (
          <div className="w-full rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-center">
            <p className="text-base font-semibold text-warning leading-snug">
              Acércate a la caja para confirmar tu pedido
            </p>
            <p className="text-xs text-foreground/60 mt-1">
              Muestra tu ficho <span className="font-bold text-foreground">{data.ticketNumber}</span> al cajero
            </p>
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
              {isReady && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-center"
                >
                  ¡Tu pedido está listo! 🎉
                </motion.p>
              )}
            </AnimatePresence>

            {/* Línea de tiempo */}
            <div className="w-full flex flex-col gap-1 mt-4">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isDone = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div key={step.status} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: isCurrent ? Infinity : 0, duration: 1.4 }}
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
                            animate={{ height: isDone && i < currentIdx ? "100%" : "0%" }}
                            transition={{ duration: 0.6 }}
                            className="absolute top-0 left-0 w-full bg-current"
                          />
                        </div>
                      )}
                    </div>
                    <span className={`font-medium ${isDone ? "" : "opacity-40"}`}>{step.label}</span>
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
                {item.notes && <span className="opacity-60"> ({item.notes})</span>}
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
