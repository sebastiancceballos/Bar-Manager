"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { ChefHat, PartyPopper, Loader2, Clock } from "lucide-react";

interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
}

interface SelfServiceOrder {
  id: number;
  ticket_number: string;
  status: string;
  created_at: string;
  items: OrderItem[];
}

const ALLOWED_ROLES = ["owner", "admin", "kitchen"];

function minutesSince(dateStr: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
}

function KitchenContent() {
  const { user } = useAuth();
  const [paid, setPaid] = useState<SelfServiceOrder[]>([]);
  const [preparing, setPreparing] = useState<SelfServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [paidRes, preparingRes] = await Promise.all([
        fetch("/api/self-service/orders?status=PAID", { cache: "no-store" }),
        fetch("/api/self-service/orders?status=PREPARING", { cache: "no-store" }),
      ]);
      const paidData = await paidRes.json();
      const preparingData = await preparingRes.json();
      setPaid(paidData.orders || []);
      setPreparing(preparingData.orders || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  async function changeStatus(id: number, status: string) {
    setBusyId(id);
    try {
      await fetch(`/api/self-service/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-error">
        No tienes permiso para acceder aquí
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-8">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-primary" /> Cocina / Barra
        </h1>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section>
              <h2 className="font-semibold text-foreground/70 mb-2">Pagados — por empezar ({paid.length})</h2>
              <div className="flex flex-col gap-3">
                {paid.length === 0 && <p className="text-foreground/40 text-sm">Nada pendiente 🎉</p>}
                {paid.map((order) => (
                  <div key={order.id} className="bg-card border border-border rounded-xl p-4">
                    <OrderHeader order={order} />
                    <button
                      disabled={busyId === order.id}
                      onClick={() => changeStatus(order.id, "PREPARING")}
                      className="mt-3 w-full min-h-[48px] bg-secondary text-white rounded-lg font-semibold disabled:opacity-50"
                    >
                      Iniciar preparación
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-semibold text-foreground/70 mb-2">En preparación ({preparing.length})</h2>
              <div className="flex flex-col gap-3">
                {preparing.length === 0 && <p className="text-foreground/40 text-sm">Nada en curso</p>}
                {preparing.map((order) => (
                  <div key={order.id} className="bg-card border border-border rounded-xl p-4">
                    <OrderHeader order={order} />
                    <button
                      disabled={busyId === order.id}
                      onClick={() => changeStatus(order.id, "READY")}
                      className="mt-3 w-full min-h-[48px] bg-success text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <PartyPopper className="w-4 h-4" /> Marcar como listo
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function OrderHeader({ order }: { order: SelfServiceOrder }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xl font-black">{order.ticket_number}</span>
        <span className="text-xs text-foreground/50 flex items-center gap-1">
          <Clock className="w-3 h-3" /> hace {minutesSince(order.created_at)} min
        </span>
      </div>
      <ul className="text-sm text-foreground/70 mt-2">
        {order.items.map((item, i) => (
          <li key={i}>
            {item.quantity}× {item.name}
            {item.notes && <span className="opacity-60"> ({item.notes})</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function KitchenPage() {
  return (
    <ProtectedLayout>
      <KitchenContent />
    </ProtectedLayout>
  );
}
