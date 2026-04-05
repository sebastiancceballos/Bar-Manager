"use client";

import { ProtectedLayout, AdminOnly } from "@/app/components/ProtectedLayout";
import { Navigation } from "@/app/components/Navigation";
import { useEffect, useState, FormEvent } from "react";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      if (response.ok) {
        await fetchProducts();
        setShowForm(false);
        setEditingId(null);
        e.currentTarget.reset();
      } else {
        setError("Failed to save product");
      }
    } catch (err) {
      setError("Error saving product");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchProducts();
      } else {
        setError("Failed to delete product");
      }
    } catch (err) {
      setError("Error deleting product");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setShowForm(true);
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
                  setShowForm(!showForm);
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
                      className="input"
                      placeholder="Ej: bebidas"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Precio
                    </label>
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="0.00"
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
                          className="card-sm flex flex-col justify-between"
                        >
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">
                              {product.name}
                            </h4>
                            <p className="text-2xl font-bold text-success mb-2">
                              ${product.price.toFixed(2)}
                            </p>
                            {!product.active && (
                              <p className="text-sm text-warning">Inactivo</p>
                            )}
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleEdit(product)}
                              className="btn btn-outline btn-sm flex-1"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="btn btn-sm px-3 py-2 bg-error/10 text-error hover:bg-error/20 border border-error/30"
                            >
                              Eliminar
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
      </AdminOnly>
    </ProtectedLayout>
  );
}
