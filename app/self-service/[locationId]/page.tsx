"use client";

import { useEffect, useMemo, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, ShoppingBag, X, Loader2, Beer, ChevronUp } from "lucide-react";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  description?: string;
  image_url?: string;
}

interface CartLine {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

function cartKey(locationId: string) {
  return `self-service-cart-${locationId}`;
}

export default function SelfServicePage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = usePromise(params);
  const router = useRouter();

  const [locationName, setLocationName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bounceProductId, setBounceProductId] = useState<number | null>(null);

  // Cargar menú
  useEffect(() => {
    fetch(`/api/self-service/menu/${locationId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "No se pudo cargar el menú");
        return data;
      })
      .then((data) => {
        setLocationName(data.location.name);
        setProducts(data.products);
        if (data.products.length > 0) setActiveCategory(data.products[0].category);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [locationId]);

  // Cargar/guardar carrito en localStorage (persistente entre visitas del cliente)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(cartKey(locationId));
      if (saved) setCart(JSON.parse(saved));
    } catch {
      // localStorage puede fallar en modo privado; el carrito simplemente empieza vacío
    }
  }, [locationId]);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey(locationId), JSON.stringify(cart));
    } catch {
      // Ignorar: no bloquear la experiencia si el navegador no permite guardar
    }
  }, [cart, locationId]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products]
  );

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id && !l.notes);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id && !l.notes ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, notes: "" }];
    });
    setBounceProductId(product.id);
    setTimeout(() => setBounceProductId(null), 350);
  }

  function updateQuantity(index: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].quantity + delta };
      return next.filter((l) => l.quantity > 0);
    });
  }

  function updateNotes(index: number, notes: string) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, notes } : l)));
  }

  async function confirmOrder() {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/self-service/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: parseInt(locationId),
          clientName: clientName || undefined,
          customerNotes: customerNotes || undefined,
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el pedido");

      localStorage.removeItem(cartKey(locationId));
      router.push(`/tracking/${data.order.trackingToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el pedido");
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-foreground">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p>Cargando menú…</p>
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-foreground px-6 text-center">
        <Beer className="w-10 h-10 text-error" />
        <p className="text-error">{error}</p>
      </div>
    );
  }

  const visibleProducts = products.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-background text-foreground text-base" style={{ paddingBottom: cart.length > 0 ? "88px" : "16px" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Beer className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-bold truncate">{locationName}</h1>
        </div>
      </header>

      {/* Categorías (scroll horizontal, mobile-first) */}
      <nav className="sticky top-[52px] z-10 bg-background/95 backdrop-blur border-b border-border overflow-x-auto whitespace-nowrap px-3 py-2 flex gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat ? "bg-primary text-white" : "bg-card text-foreground/70 border border-border"
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* Grid de productos */}
      <main className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {visibleProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => addToCart(product)}
            className="text-left bg-card border border-border rounded-xl overflow-hidden flex flex-col active:scale-95 transition-transform"
          >
            <div className="aspect-square bg-slate-800 relative overflow-hidden">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-foreground/30">
                  <Beer className="w-8 h-8" />
                </div>
              )}
              <AnimatePresence>
                {bounceProductId === product.id && (
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1.15, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/30"
                  >
                    <div className="bg-success text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      +1
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="p-2 flex flex-col gap-1 flex-1">
              <span className="text-sm font-semibold line-clamp-2">{product.name}</span>
              {product.description && (
                <span className="text-xs text-foreground/60 line-clamp-2">{product.description}</span>
              )}
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-primary font-bold">{formatCOP(product.price)}</span>
                <span className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary/20 text-primary rounded-full">
                  <Plus className="w-4 h-4" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </main>

      {/* Barra de carrito fija (mobile) */}
      <AnimatePresence>
        {cart.length > 0 && !isSheetOpen && (
          <motion.button
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            onClick={() => setIsSheetOpen(true)}
            className="fixed bottom-0 left-0 right-0 z-30 bg-primary text-white px-4 py-4 flex items-center justify-between min-h-[64px] shadow-2xl"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="w-5 h-5" />
              {cartCount} {cartCount === 1 ? "producto" : "productos"}
            </span>
            <span className="flex items-center gap-2 font-bold">
              {formatCOP(cartTotal)}
              <ChevronUp className="w-5 h-5" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom sheet del carrito */}
      <AnimatePresence>
        {isSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSheetOpen(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-lg">Tu pedido</h2>
                <button
                  onClick={() => setIsSheetOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
                {cart.map((line, index) => (
                  <div key={index} className="bg-background rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{line.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(index, -1)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-card rounded-full"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-6 text-center font-semibold">{line.quantity}</span>
                        <button
                          onClick={() => updateQuantity(index, 1)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-card rounded-full"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={line.notes}
                      onChange={(e) => updateNotes(index, e.target.value)}
                      placeholder="Notas (ej. sin hielo)"
                      className="mt-2 w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                ))}

                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  className="w-full bg-background border border-border rounded-lg px-3 py-3 text-base"
                />
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Notas generales del pedido (opcional)"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
                {error && <p className="text-error text-sm">{error}</p>}
              </div>

              <div className="p-4 border-t border-border">
                <button
                  onClick={confirmOrder}
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full min-h-[52px] bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Confirmar pedido · {formatCOP(cartTotal)}</>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
