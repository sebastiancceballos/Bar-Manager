"use client";

import { useEffect, useState } from "react";
import { downloadInvoice } from "./InvoicePDF";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);


interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  table_number: string;
  waiter_name: string;
  waiter_email: string;
  modifier_name?: string;
  modifier_email?: string;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  location_name: string;
  items: OrderItem[];
}

interface DailyOrdersModalProps {
  date: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DailyOrdersModal({ date, isOpen, onClose }: DailyOrdersModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (isOpen && date) {
      fetchOrders();
    }
  }, [isOpen, date]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/daily/${date}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Órdenes del {new Date(date).toLocaleDateString("es-ES")}
            </h2>
            <p className="text-gray-400 text-sm mt-1">Total de órdenes: {orders.length}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-foreground text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center text-gray-400">Cargando órdenes...</div>
          ) : orders.length === 0 ? (
            <div className="text-center text-gray-400">No hay órdenes para este día</div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-card p-4 rounded-lg border border-border hover:border-primary transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        Factura #{order.id} - Mesa {order.table_number}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(order.created_at).toLocaleString("es-ES")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-success">
                        {formatCOP(Number(order.total_amount))}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{order.status}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-gray-400">Mesero</p>
                      <p className="text-foreground">{order.waiter_name}</p>
                    </div>
                    {order.modifier_name && order.modifier_name !== order.waiter_name && (
                      <div>
                        <p className="text-gray-400">Última modificación</p>
                        <p className="text-foreground">{order.modifier_name}</p>
                      </div>
                    )}
                  </div>

                  {/* Items preview */}
                  <div className="mb-3 max-h-20 overflow-hidden">
                    <p className="text-xs text-gray-400 mb-1">Productos ({order.items.length}):</p>
                    <div className="text-xs text-gray-300">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>{item.product_name} x{item.quantity}</span>
                          <span>{formatCOP(Number(item.price) * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 bg-primary text-white py-2 rounded text-sm hover:bg-primary/90 transition-colors"
                    >
                      Ver Detalles
                    </button>
                    <button
                      onClick={() => downloadInvoice(order)}
                      className="flex-1 bg-card border border-border text-foreground py-2 rounded text-sm hover:border-primary transition-colors"
                    >
                      Descargar PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex justify-between items-center">
              <h3 className="text-xl font-bold text-foreground">Detalles de Factura #{selectedOrder.id}</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-foreground text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Bar</p>
                  <p className="text-foreground font-semibold">{selectedOrder.location_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Mesa</p>
                  <p className="text-foreground font-semibold">{selectedOrder.table_number}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Fecha</p>
                  <p className="text-foreground font-semibold">
                    {new Date(selectedOrder.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Hora</p>
                  <p className="text-foreground font-semibold">
                    {new Date(selectedOrder.created_at).toLocaleTimeString("es-ES")}
                  </p>
                </div>
              </div>

              {/* Mesero Info */}
              <div className="bg-card p-4 rounded border border-border">
                <p className="text-foreground font-semibold mb-2">Mesero Responsable</p>
                <p className="text-gray-300">{selectedOrder.waiter_name}</p>
                <p className="text-gray-400 text-sm">{selectedOrder.waiter_email}</p>
              </div>

              {/* Modificador Info */}
              {selectedOrder.modifier_name && selectedOrder.modifier_name !== selectedOrder.waiter_name && (
                <div className="bg-card p-4 rounded border border-border">
                  <p className="text-foreground font-semibold mb-2">Última Modificación Por</p>
                  <p className="text-gray-300">{selectedOrder.modifier_name}</p>
                  <p className="text-gray-400 text-sm">{selectedOrder.modifier_email}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {new Date(selectedOrder.updated_at).toLocaleString("es-ES")}
                  </p>
                </div>
              )}

              {/* Items */}
              <div>
                <p className="text-foreground font-semibold mb-3">Productos</p>
                <div className="bg-card rounded border border-border overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 bg-card/50 p-3 border-b border-border font-semibold text-sm text-gray-300">
                    <div>Producto</div>
                    <div className="text-center">Cantidad</div>
                    <div className="text-right">Precio</div>
                    <div className="text-right">Subtotal</div>
                  </div>
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-4 gap-2 p-3 border-b border-border/50 text-sm"
                    >
                      <div className="text-foreground">{item.product_name}</div>
                      <div className="text-center text-gray-400">{item.quantity}</div>
                      <div className="text-right text-gray-400">{formatCOP(Number(item.price))}</div>
                      <div className="text-right text-foreground font-semibold">
                        {formatCOP(Number(item.price) * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-gray-400 text-sm mb-2">Total</p>
                  <p className="text-3xl font-bold text-success">
                    {formatCOP(Number(selectedOrder.total_amount))}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => downloadInvoice(selectedOrder)}
                  className="flex-1 bg-success text-white py-2 rounded font-semibold hover:bg-success/90 transition-colors"
                >
                  Descargar PDF
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 bg-card border border-border text-foreground py-2 rounded font-semibold hover:border-primary transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}