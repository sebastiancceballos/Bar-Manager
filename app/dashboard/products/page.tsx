"use client";

import { ProtectedLayout, AdminOnly } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState, FormEvent } from "react";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
}

interface StockMovement {
  id: number;
  product_id: string;
  quantity: number;
  type: 'entry' | 'exit' | 'sale' | 'waste';
  reason: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
      }
    } catch (err) {
      setError("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const price = formData.get("price") as string;

    try {
      const response = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, category, price: parseFloat(price) }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        await fetchProducts();
        setShowForm(false);
        setEditingId(null);
        setEditingProduct(null);
        setError(null);
        (e.target as HTMLFormElement).reset();
      } else {
        setError(data.error || "Error al guardar el producto");
      }
    } catch (err) {
      setError("Error de conexión al guardar el producto");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (response.ok) {
        await fetchProducts();
        setError(null);
      } else {
        setError(data.error || "Error al eliminar el producto");
      }
    } catch (err) {
      setError("Error de conexión al eliminar el producto");
    }
  };

  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  const handleAdjustStock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setAdjusting(true);

    const formData = new FormData(e.currentTarget);
    const quantity = parseInt(formData.get("quantity") as string);
    const type = formData.get("type") as string;
    const reason = formData.get("reason") as string;

    try {
      const response = await fetch(`/api/products/${selectedProduct.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, type, reason }),
      });

      const data = await response.json();
      if (response.ok) {
        await fetchProducts();
        setShowStockModal(false);
        (e.target as HTMLFormElement).reset();
      } else {
        setModalError(data.error || "Error del servidor al ajustar stock");
      }
    } catch (err) {
      setModalError("Error de conexión: No se pudo guardar el ajuste");
    } finally {
      setAdjusting(false);
    }
  };

  const fetchHistory = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/history`);
      if (res.ok) {
        const data = await res.json();
        setMovements(data.movements);
        setShowHistory(true);
      }
    } catch (err) {
      setError("Error al cargar historial");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditingProduct(product);
    setShowForm(true);
    setError(null);
  };

  const groupedProducts = products.reduce(
    (acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    },
    {} as Record<string, Product[]>
  );

  return (
    <ProtectedLayout>
      <AdminOnly>
        <Navigation />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-4xl font-bold text-foreground">Productos</h1>
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditingProduct(null);
                  setShowForm(!showForm);
                  setError(null);
                }}
                className="btn btn-primary"
              >
                {showForm ? "Cancelar" : "Nuevo Producto"}
              </button>
            </div>

            {error && (
              <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {showForm && (
              <form
                onSubmit={handleSubmit}
                className="card mb-8 space-y-4"
              >
                <h3 className="text-xl font-semibold">
                  {editingId ? "Editar Producto" : "Nuevo Producto"}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nombre
                    </label>
                    <input
                      name="name"
                      type="text"
                      className="input"
                      placeholder="Ej: Cerveza"
                      defaultValue={editingProduct?.name || ""}
                      key={editingProduct?.id + "-name"}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Categoría
                    </label>
                    <input
                      name="category"
                      type="text"
                      list="category-list"
                      className="input"
                      placeholder="Ej: bebidas"
                      defaultValue={editingProduct?.category || ""}
                      key={editingProduct?.id + "-category"}
                      required
                    />
                    <datalist id="category-list">
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Precio
                    </label>
                    <input
                      name="price"
                      type="number"
                      step="1"
                      min="0"
                      className="input"
                      placeholder="Ej: 5000"
                      defaultValue={editingProduct?.price || ""}
                      key={editingProduct?.id + "-price"}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary">
                  {editingId ? "Actualizar" : "Crear"} Producto
                </button>
              </form>
            )}

            {loading ? (
              <div className="text-gray-400">Cargando productos...</div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedProducts).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-2xl font-semibold text-primary mb-4 capitalize">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((product) => (
                        <div
                          key={product.id}
                          className="card-sm flex flex-col justify-between group relative overflow-hidden"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground mb-1">
                                {product.name}
                              </h4>
                              <p className="text-2xl font-bold text-success mb-2">
                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(Number(product.price))}
                              </p>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                              product.stock <= 5 ? "bg-error/20 text-error" : "bg-primary/20 text-primary"
                            }`}>
                              Stock: {product.stock}
                            </div>
                          </div>

                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setModalError(null);
                                setShowStockModal(true);
                              }}
                              className="btn btn-outline btn-sm flex-1 text-[10px]"
                            >
                              Stock
                            </button>
                            <button
                              onClick={() => fetchHistory(product.id)}
                              className="btn btn-outline btn-sm flex-1 text-[10px]"
                            >
                              Reloj
                            </button>
                            <button
                              onClick={() => handleEdit(product)}
                              className="btn btn-primary btn-sm px-2"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {products.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No hay productos aún</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal de Ajuste de Stock */}
        {showStockModal && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl">
              <h2 className="text-2xl font-bold mb-4">Ajustar Inventario</h2>
              <p className="text-gray-400 mb-6">Producto: <span className="text-foreground font-semibold">{selectedProduct.name}</span></p>
              
              {modalError && (
                <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg mb-6 text-sm animate-shake">
                  ⚠️ {modalError}
                </div>
              )}

              <form onSubmit={handleAdjustStock} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Movimiento</label>
                  <select name="type" className="input w-full" required>
                    <option value="entry">Entrada (Compra/Reposición)</option>
                    <option value="exit">Salida (Ajuste manual)</option>
                    <option value="waste">Merma/Daño</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cantidad</label>
                  <input name="quantity" type="number" min="1" className="input w-full" placeholder="10" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Motivo (Opcional)</label>
                  <input name="reason" type="text" className="input w-full" placeholder="Compra de lote semanal" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={adjusting} className="btn btn-primary flex-1">
                    {adjusting ? "Guardando..." : "Confirmar"}
                  </button>
                  <button type="button" onClick={() => setShowStockModal(false)} className="btn btn-secondary flex-1">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Historial (Trazabilidad) */}
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Trazabilidad de Stock</h2>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
              </div>
              
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                  <thead className="border-b border-border">
                    <tr className="text-gray-400 text-sm">
                      <th className="py-2">Fecha</th>
                      <th className="py-2">Tipo</th>
                      <th className="py-2">Cant.</th>
                      <th className="py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {movements.map((m) => (
                      <tr key={m.id} className="text-sm">
                        <td className="py-3">{new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            m.type === 'entry' ? 'bg-success/20 text-success' : 
                            m.type === 'sale' ? 'bg-primary/20 text-primary' :
                            'bg-error/20 text-error'
                          }`}>
                            {m.type === 'entry' ? 'Entrada' : m.type === 'sale' ? 'Venta' : m.type === 'waste' ? 'Merma' : 'Salida'}
                          </span>
                        </td>
                        <td className="py-3 font-semibold">{m.quantity}</td>
                        <td className="py-3 text-gray-400">{m.reason || '-'}</td>
                      </tr>
                    ))}
                    {movements.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-gray-500">Sin movimientos registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </AdminOnly>
    </ProtectedLayout>
  );
}