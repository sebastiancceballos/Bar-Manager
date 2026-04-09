"use client";

import { ProtectedLayout } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/app/providers";
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

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Record<number, Order>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [draggingTable, setDraggingTable] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTable, setNewTable] = useState({ table_number: "", capacity: 4 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const canDrag = isAdmin;

  const fetchData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleMouseDown = (e: React.MouseEvent, tableId: number) => {
    if (!canDrag) return;
    e.preventDefault();
    
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - 50,
      y: e.clientY - rect.top - 50,
    });
    setDraggingTable(tableId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingTable || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x - 50;
    const newY = e.clientY - containerRect.top - dragOffset.y - 50;

    // Clamp to container bounds
    const clampedX = Math.max(0, Math.min(newX, containerRect.width - 100));
    const clampedY = Math.max(0, Math.min(newY, containerRect.height - 100));

    setTables(prev =>
      prev.map(t =>
        t.id === draggingTable
          ? { ...t, x_position: clampedX, y_position: clampedY }
          : t
      )
    );
  }, [draggingTable, dragOffset]);

  const handleMouseUp = useCallback(async () => {
    if (!draggingTable) return;

    const table = tables.find(t => t.id === draggingTable);
    if (table) {
      try {
        await fetch(`/api/tables/${draggingTable}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x_position: table.x_position,
            y_position: table.y_position,
          }),
        });
      } catch (error) {
        console.error("Failed to save position:", error);
      }
    }

    setDraggingTable(null);
  }, [draggingTable, tables]);

  useEffect(() => {
    if (draggingTable) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingTable, handleMouseMove, handleMouseUp]);

  const handleTableClick = (tableId: number) => {
    if (draggingTable) return;
    setSelectedTableId(tableId);
    setShowOrderModal(true);
  };

  const handleOrderUpdate = () => {
    fetchData();
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTable,
          x_position: Math.random() * 400 + 50,
          y_position: Math.random() * 300 + 50,
        }),
      });

      if (res.ok) {
        setShowAddForm(false);
        setNewTable({ table_number: "", capacity: 4 });
        fetchData();
      }
    } catch (error) {
      console.error("Failed to add table:", error);
    }
  };

  const handleDeleteTable = async (tableId: number) => {
    if (!confirm("Eliminar esta mesa?")) return;
    
    try {
      await fetch(`/api/tables/${tableId}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to delete table:", error);
    }
  };

  // Calculate table size based on capacity
  const getTableSize = (capacity: number) => {
    const baseSize = 80;
    const extraSize = Math.min(capacity - 2, 6) * 10;
    return baseSize + extraSize;
  };

  return (
    <ProtectedLayout>
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mesas</h1>
              {isAdmin && (
                <p className="text-sm text-gray-400 mt-1">
                  Arrastra las mesas para reorganizar el layout
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-primary"
              >
                + Nueva Mesa
              </button>
            )}
          </div>

          {showAddForm && isAdmin && (
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-4">Agregar Mesa</h2>
              <form onSubmit={handleAddTable} className="flex gap-4 items-end">
                <div>
                  <label className="block text-sm mb-1">Numero</label>
                  <input
                    type="text"
                    value={newTable.table_number}
                    onChange={(e) => setNewTable({ ...newTable, table_number: e.target.value })}
                    className="input w-24"
                    placeholder="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Capacidad</label>
                  <input
                    type="number"
                    value={newTable.capacity || ""}
                    onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 0 })}
                    className="input w-24"
                    min="1"
                    max="12"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400">Cargando mesas...</div>
          ) : (
            <div
              ref={containerRef}
              className="relative bg-card border border-border rounded-xl overflow-hidden"
              style={{ height: "600px" }}
            >
              {/* Grid pattern background */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(circle, #666 1px, transparent 1px)",
                  backgroundSize: "30px 30px",
                }}
              />

              {tables.map((table) => {
                const order = orders[table.id];
                const isOccupied = !!order;
                const size = getTableSize(table.capacity);
                const isDragging = draggingTable === table.id;

                return (
                  <div
                    key={table.id}
                    onMouseDown={(e) => handleMouseDown(e, table.id)}
                    onClick={() => !isDragging && handleTableClick(table.id)}
                    className={`absolute flex flex-col items-center justify-center rounded-full border-4 transition-shadow select-none ${
                      isDragging ? "z-50 shadow-2xl scale-105" : "z-10"
                    } ${
                      isOccupied
                        ? "border-secondary bg-secondary/20 shadow-secondary/30"
                        : "border-border bg-card hover:border-primary hover:shadow-primary/20"
                    } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      left: `${table.x_position || 50}px`,
                      top: `${table.y_position || 50}px`,
                      boxShadow: isOccupied
                        ? "0 0 20px rgba(var(--secondary-rgb), 0.3)"
                        : isDragging
                        ? "0 10px 40px rgba(0,0,0,0.3)"
                        : "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    <span className="text-xl font-bold text-foreground">
                      {table.table_number}
                    </span>
                    <span className="text-xs text-gray-400">
                      {table.capacity} pers.
                    </span>
                    {isOccupied && (
                      <span className="text-xs font-semibold text-secondary mt-1">
                        ${Number(order.total_amount).toFixed(0)}
                      </span>
                    )}

                    {/* Delete button for admin */}
                    {isAdmin && !isOccupied && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table.id);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors flex items-center justify-center"
                      >
                        X
                      </button>
                    )}
                  </div>
                );
              })}

              {tables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <p className="mb-4">No hay mesas configuradas</p>
                    {isAdmin && (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="btn-primary"
                      >
                        Agregar primera mesa
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-6 mt-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-border bg-card"></div>
              <span>Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-secondary bg-secondary/20"></div>
              <span>Ocupada</span>
            </div>
          </div>

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
