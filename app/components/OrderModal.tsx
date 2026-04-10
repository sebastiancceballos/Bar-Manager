"use client";

import { useEffect, useState } from "react";

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
}

interface OrderModalProps {
  tableId: number;
  tableNumber: string;
  order: Order | null;
  onClose: () => void;
  onUpdate: () => void;
  open: boolean;
}

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

export function OrderModal({
  tableId,
  tableNumber,
  order,
  onClose,
  onUpdate,
  open,
}: OrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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
      const response = await fetch(`/api/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to add item:", error);
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

  const handleCloseOrder = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      if (response.ok) {
        onUpdate();
        onClose();
      }
    } catch (error) {
      console.error("Failed to close order:", error);
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
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={updating}
                        className="btn btn-sm px-3 py-1 bg-error/10 text-error hover:bg-error/20 disabled:opacity-50"
                      >
                        ✕
                      </button>
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

              <button
                onClick={handleCloseOrder}
                disabled={updating || order.items.length === 0}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {updating ? "Procesando..." : "Cerrar Orden"}
              </button>
            </div>
          )}

          {/* Add Items */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Agregar Items</h3>

            {loading ? (
              <p className="text-gray-400">Cargando productos...</p>
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

                <div className="grid grid-cols-2 gap-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddItem(product.id)}
                      disabled={updating}
                      className="btn btn-outline p-4 text-left disabled:opacity-50 hover:border-primary"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-success">
                        {formatCOP(Number(product.price))}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}