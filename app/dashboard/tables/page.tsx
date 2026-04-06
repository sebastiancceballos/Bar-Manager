"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState } from "react";
import { OrderModal } from "@/app/components/OrderModal";

interface Table {
  id: number;
  table_number: string;
  capacity: number;
  x_position: number;
  y_position: number;
}

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
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

export default function WaiterTablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Record<number, Order>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const fetchData = async () => {
    try {
      const [tablesRes, ordersRes] = await Promise.all([
        fetch("/api/tables"),
        fetch("/api/orders"),
      ]);

      if (tablesRes.ok) {
        const data = await tablesRes.json();
        setTables(data.tables);
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const ordersMap = data.orders.reduce(
          (acc: Record<number, Order>, order: Order) => {
            acc[order.table_id] = order;
            return acc;
          },
          {}
        );
        setOrders(ordersMap);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTableClick = (tableId: number) => {
    setSelectedTableId(tableId);
    setShowOrderModal(true);
  };

  const handleOrderUpdate = () => {
    fetchData();
  };

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold text-foreground mb-8">Mesas</h1>

          {loading ? (
            <div className="text-gray-400">Cargando mesas...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map((table) => {
                const order = orders[table.id];
                const isOccupied = !!order;

                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableClick(table.id)}
                    className={`aspect-square rounded-lg border-2 transition-smooth flex flex-col items-center justify-center gap-2 font-semibold cursor-pointer ${
                      isOccupied
                        ? "border-secondary bg-secondary/10 hover:bg-secondary/20"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    <div className="text-3xl">{table.table_number}</div>
                    {isOccupied && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-gray-400">
                          ${order.total_amount.toFixed(2)}
                        </div>
                        <div className="text-xs bg-secondary/20 px-2 py-1 rounded text-secondary">
                          {order.items.length} items
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedTableId && (
            <OrderModal
              tableId={selectedTableId}
              order={orders[selectedTableId] || null}
              onClose={() => {
                setShowOrderModal(false);
                setSelectedTableId(null);
              }}
              onUpdate={handleOrderUpdate}
              open={showOrderModal}
            />
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
