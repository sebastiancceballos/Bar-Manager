"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "./Skeleton";
import { useAuth } from "@/app/providers";

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  product: {
    name: string;
    price: number;
  };
}

interface Order {
  id: number;
  table_id: number;
  total_amount: number;
  items: OrderItem[];
}

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
}

interface AvailableTable {
  id: number;
  table_number: string;
}

interface OrderModalProps {
  tableId: number;
  tableNumber: string;
  order: Order | null;
  onClose: () => void;
  onUpdate: () => void;
  open: boolean;
  availableTables?: AvailableTable[];
}

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
];

export function OrderModal({
  tableId,
  tableNumber,
  order,
  onClose,
  onUpdate,
  open,
  availableTables = [],
}: OrderModalProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [tipAmount, setTipAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [authorizerEmail, setAuthorizerEmail] = useState("");
  const [authorizerPassword, setAuthorizerPassword] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>("");
  const [transferError, setTransferError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isCashier = user?.role === "cashier";
  const isWaiter = user?.role === "waiter";
  /** Solo caja / admin pueden cobrar y cerrar */
  const canCharge = isAdmin || isCashier;
  /** Mesero (y caja) pueden pedir cuenta */
  const canRequestBill = isWaiter || canCharge;

  useEffect(() => {
    if (!open) return;

    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products");
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products);
          if (data.products.length > 0) {
            setSelectedCategory(data.products[0].category);
          }
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [open]);

  const categories = Array.from(new Set(products.map((p) => p.category)));
  const filteredProducts = products.filter(
    (p) => p.category === selectedCategory
  );

  const handleAddItem = async (productId: number) => {
    if (!order) {
      // Create order first
      try {
        setUpdating(true);
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: tableId.toString() }),
        });

        if (response.ok) {
          const data = await response.json();
          const newOrder = data.order;
          // Add item to the new order
          await handleAddItemToOrder(newOrder.id, productId);
        }
      } catch (error) {
        console.error("Failed to create order:", error);
      } finally {
        setUpdating(false);
      }
      return;
    }

    await handleAddItemToOrder(order.id, productId);
  };

  const handleAddItemToOrder = async (orderId: number, productId: number) => {
    try {
      setUpdating(true);
      setError(null);
      const response = await fetch(`/api/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        setError(data.error || "Error al agregar item");
      }
    } catch (error) {
      console.error("Failed to add item:", error);
      setError("Error de conexión al agregar item");
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    if (!order) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/orders/${order.id}/items/${itemId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDecrementItem = async (itemId: number) => {
    if (!order) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/orders/${order.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decrement" }),
      });

      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        setError(data.error || "Error al reducir item");
      }
    } catch (error) {
      console.error("Failed to decrement item:", error);
      setError("Error de conexión");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenPayment = () => {
    setPaymentError(null);
    setPaymentMethod("efectivo");
    setTipAmount("0");
    setDiscountAmount("0");
    setDiscountReason("");
    setAuthorizerEmail("");
    setAuthorizerPassword("");
    setAmountReceived("");
    setShowPayment(true);
  };

  const handleManualStatus = async (newStatus: string) => {
    if (!order) return;
    setStatusUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "No se pudo cambiar el estado");
        return;
      }
      onUpdate();
      if (newStatus === "bill_requested") {
        // mantener modal abierto; el estado se refleja al refrescar
      }
    } catch {
      setError("Error de conexión al cambiar estado");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!order) return;
    setPaymentError(null);

    const tip = parseFloat(tipAmount) || 0;
    const discount = parseFloat(discountAmount) || 0;
    const subtotal = Number(order.total_amount) || 0;
    // Estimación en cliente (el servidor recalcula IVA exacto)
    const estimatedTotal = Math.max(0, subtotal - discount) + tip;
    const received = parseFloat(amountReceived);

    if (paymentMethod === "efectivo") {
      if (!amountReceived || Number.isNaN(received)) {
        setPaymentError("Indica con cuánto paga el cliente");
        return;
      }
      if (received < estimatedTotal - 0.01) {
        setPaymentError(
          `El monto recibido (${formatCOP(received)}) es menor al total (${formatCOP(estimatedTotal)})`
        );
        return;
      }
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          paymentMethod,
          tipAmount: tip,
          discountAmount: discount,
          discountReason,
          authorizerEmail: isAdmin ? undefined : authorizerEmail,
          authorizerPassword: isAdmin ? undefined : authorizerPassword,
          amountReceived: paymentMethod === "efectivo" ? received : undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setShowPayment(false);
        onUpdate();
        onClose();
      } else {
        setPaymentError(data.error || "Error al cobrar la orden");
      }
    } catch (error) {
      console.error("Failed to close order:", error);
      setPaymentError("Error de conexión al cobrar");
    } finally {
      setUpdating(false);
    }
  };

  const handleTransfer = async () => {
    if (!order || !transferTargetId) return;
    setTransferError(null);
    setUpdating(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTableId: transferTargetId }),
      });
      const data = await response.json();
      if (response.ok) {
        setShowTransfer(false);
        onUpdate();
        onClose();
      } else {
        setTransferError(data.error || "Error al transferir la mesa");
      }
    } catch (error) {
      console.error("Failed to transfer order:", error);
      setTransferError("Error de conexión al transferir");
    } finally {
      setUpdating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Mesa {tableNumber}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-foreground transition-smooth"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm animate-shake">
              ⚠️ {error}
            </div>
          )}

          {/* Current Order */}
          {order && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Orden Actual</h3>
              <div className="space-y-2 mb-4">
                {order.items.length === 0 ? (
                  <p className="text-gray-400">No hay items en la orden</p>
                ) : (
                  order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-background p-3 rounded"
                    >
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-gray-400">
                          x{item.quantity} - {formatCOP(Number(item.price) * item.quantity)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecrementItem(item.id)}
                          disabled={updating}
                          title="Restar 1 unidad"
                          className="btn btn-sm px-3 py-1 bg-warning/10 text-warning hover:bg-warning/20 disabled:opacity-50"
                        >
                          −
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={updating}
                          title="Eliminar todo"
                          className="btn btn-sm px-3 py-1 bg-error/10 text-error hover:bg-error/20 disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-background p-4 rounded mb-4 border border-border">
                <p className="text-gray-400 mb-2">Total</p>
                <p className="text-3xl font-bold text-success">
                  {formatCOP(Number(order.total_amount))}
                </p>
              </div>

              {/* Estados manuales */}
              <div className="flex flex-col gap-2 mb-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Estado de la cuenta</p>
                <div className="flex flex-wrap gap-2">
                  {canRequestBill && (
                    <button
                      type="button"
                      onClick={() => handleManualStatus("bill_requested")}
                      disabled={statusUpdating || updating || order.items.length === 0}
                      className="btn btn-outline btn-sm disabled:opacity-50"
                    >
                      {statusUpdating ? "..." : "Cuenta pedida"}
                    </button>
                  )}
                  {canCharge && (
                    <button
                      type="button"
                      onClick={() => handleManualStatus("open")}
                      disabled={statusUpdating || updating}
                      className="btn btn-outline btn-sm disabled:opacity-50"
                      title="Volver a en curso"
                    >
                      En curso
                    </button>
                  )}
                </div>
                {!canCharge && isWaiter && (
                  <p className="text-xs text-warning">
                    Solo caja puede cobrar y cerrar la mesa.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {canCharge && (
                  <button
                    onClick={handleOpenPayment}
                    disabled={updating || order.items.length === 0}
                    className="btn btn-primary flex-1 disabled:opacity-50"
                  >
                    {updating ? "Procesando..." : "Cobrar y Cerrar"}
                  </button>
                )}
                {availableTables.length > 0 && (
                  <button
                    onClick={() => {
                      setTransferError(null);
                      setTransferTargetId("");
                      setShowTransfer(true);
                    }}
                    disabled={updating}
                    className="btn btn-outline disabled:opacity-50"
                    title="Transferir a otra mesa"
                  >
                    🔀 Transferir
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Add Items */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Agregar Items</h3>

            {loading ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="w-full h-20" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`btn btn-sm whitespace-nowrap ${selectedCategory === cat
                        ? "btn-primary"
                        : "btn-outline"
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map((product) => {
                    const isOutOfStock = (product.stock || 0) <= 0;
                    return (
                      <button
                        key={product.id}
                        onClick={() => handleAddItem(product.id)}
                        disabled={updating || isOutOfStock}
                        className={`btn min-h-[80px] p-4 text-left flex flex-col justify-center items-start transition-all active:scale-95 ${
                          isOutOfStock 
                          ? "bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed opacity-60" 
                          : "btn-outline hover:border-primary"
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <div className="font-bold text-lg">{product.name}</div>
                          <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            isOutOfStock ? "bg-red-500/20 text-red-400" : "bg-primary/10 text-primary"
                          }`}>
                            Stock: {product.stock || 0}
                          </div>
                        </div>
                        <div className={`text-sm font-semibold ${isOutOfStock ? "text-gray-600" : "text-primary"}`}>
                          {formatCOP(Number(product.price))}
                          {isOutOfStock && <span className="ml-2 text-xs font-normal">(AGOTADO)</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Cobro */}
      {showPayment && order && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Cobrar Mesa {tableNumber}</h3>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-foreground text-2xl">&times;</button>
            </div>

            {paymentError && (
              <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
                ⚠️ {paymentError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Método de pago</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`btn btn-sm ${paymentMethod === m.value ? "btn-primary" : "btn-outline"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Propina</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input w-full"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Descuento (COP)</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input w-full"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>

            {parseFloat(discountAmount) > 0 && (
              <div className="space-y-3 bg-background p-3 rounded-lg border border-border">
                <div>
                  <label className="block text-sm font-medium mb-2">Motivo del descuento</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Ej: cliente frecuente, error del mesero..."
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
                {!isAdmin && (
                  <>
                    <p className="text-xs text-gray-400">
                      Los descuentos necesitan autorización de un admin. Pídele que ingrese sus credenciales:
                    </p>
                    <input
                      type="email"
                      className="input w-full"
                      placeholder="Email del admin"
                      value={authorizerEmail}
                      onChange={(e) => setAuthorizerEmail(e.target.value)}
                    />
                    <input
                      type="password"
                      className="input w-full"
                      placeholder="Contraseña del admin"
                      value={authorizerPassword}
                      onChange={(e) => setAuthorizerPassword(e.target.value)}
                    />
                  </>
                )}
              </div>
            )}

            <div className="bg-background p-4 rounded border border-border text-sm space-y-2">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{formatCOP(Number(order.total_amount))}</span>
              </div>
              {(parseFloat(discountAmount) || 0) > 0 && (
                <div className="flex justify-between text-warning">
                  <span>Descuento</span>
                  <span>-{formatCOP(parseFloat(discountAmount) || 0)}</span>
                </div>
              )}
              {(parseFloat(tipAmount) || 0) > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Propina</span>
                  <span>{formatCOP(parseFloat(tipAmount) || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground text-base pt-1 border-t border-border">
                <span>Total a pagar</span>
                <span>
                  {formatCOP(
                    Math.max(
                      0,
                      Number(order.total_amount) - (parseFloat(discountAmount) || 0)
                    ) + (parseFloat(tipAmount) || 0)
                  )}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Si el bar tiene IVA, el servidor lo suma al confirmar.
              </p>
            </div>

            {paymentMethod === "efectivo" && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">¿Con cuánto paga el cliente?</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input w-full text-lg font-semibold"
                  placeholder="Ej: 50000"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                />
                {amountReceived && !Number.isNaN(parseFloat(amountReceived)) && (
                  <div
                    className={`p-3 rounded-lg border text-center ${
                      parseFloat(amountReceived) >=
                      Math.max(
                        0,
                        Number(order.total_amount) - (parseFloat(discountAmount) || 0)
                      ) +
                        (parseFloat(tipAmount) || 0)
                        ? "bg-success/10 border-success/30 text-success"
                        : "bg-error/10 border-error/30 text-error"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wide opacity-80">Vuelto a devolver</p>
                    <p className="text-2xl font-black">
                      {formatCOP(
                        Math.max(
                          0,
                          parseFloat(amountReceived) -
                            (Math.max(
                              0,
                              Number(order.total_amount) - (parseFloat(discountAmount) || 0)
                            ) +
                              (parseFloat(tipAmount) || 0))
                        )
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleConfirmPayment}
              disabled={updating}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {updating ? "Procesando..." : "Confirmar cobro"}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Transferencia de Mesa */}
      {showTransfer && order && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4">
          <div className="bg-card border border-border rounded-lg max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Transferir Mesa {tableNumber}</h3>
              <button onClick={() => setShowTransfer(false)} className="text-gray-400 hover:text-foreground text-2xl">&times;</button>
            </div>

            {transferError && (
              <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
                ⚠️ {transferError}
              </div>
            )}

            <label className="block text-sm font-medium mb-2">Mover la orden a:</label>
            <select
              className="input w-full"
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
            >
              <option value="">Selecciona una mesa</option>
              {availableTables.map((t) => (
                <option key={t.id} value={t.id}>Mesa {t.table_number}</option>
              ))}
            </select>

            <button
              onClick={handleTransfer}
              disabled={updating || !transferTargetId}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {updating ? "Transfiriendo..." : "Confirmar transferencia"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}