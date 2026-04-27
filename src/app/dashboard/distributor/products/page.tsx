"use client";
import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { v4 as uuidv4 } from "uuid";

type Product = { id: string; name: string; price: number; stock: number };

export default function DistributorProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Add product form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit product
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const fetchProducts = useCallback(async (searchVal: string, cursorVal: string | null, append: boolean) => {
    const params = new URLSearchParams({ limit: "20" });
    if (searchVal) params.set("search", searchVal);
    if (cursorVal) params.set("cursor", cursorVal);
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts((prev) => (append ? [...prev, ...data.data] : data.data));
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProducts(search, null, false).finally(() => setLoading(false));
  }, [search, fetchProducts]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
      body: JSON.stringify({ name: newName, price: parseFloat(newPrice), stock: parseInt(newStock) }),
    });

    if (!res.ok) {
      const err = await res.json();
      setAddError(err.error?.message ?? "Failed to add product.");
    } else {
      setShowAdd(false);
      setNewName(""); setNewPrice(""); setNewStock("");
      await fetchProducts(search, null, false);
    }
    setAddLoading(false);
  }

  async function saveEdit(id: string) {
    setEditLoading(true);
    const body: Record<string, number> = {};
    if (editPrice) body.price = parseFloat(editPrice);
    if (editStock) body.stock = parseInt(editStock);

    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setEditId(null);
    setEditLoading(false);
    await fetchProducts(search, null, false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Products</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Add product modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold mb-4">Add Product</h2>
            {addError && <p className="text-sm text-red-600 mb-3">{addError}</p>}
            <form onSubmit={addProduct} className="space-y-3">
              <input required placeholder="Product name" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-3">
                <input required type="number" min="0" step="0.01" placeholder="Price (Rs)" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input required type="number" min="0" placeholder="Stock" value={newStock} onChange={(e) => setNewStock(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
                <button type="submit" disabled={addLoading}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                  {addLoading ? "Adding…" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input type="search" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No products found</div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              {editId === p.id ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.01" placeholder={`Price: ${Number(p.price).toFixed(0)}`}
                      value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="number" min="0" placeholder={`Stock: ${p.stock}`}
                      value={editStock} onChange={(e) => setEditStock(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditId(null)} className="flex-1 border border-gray-200 rounded-lg py-2 text-xs text-gray-600">Cancel</button>
                    <button onClick={() => saveEdit(p.id)} disabled={editLoading}
                      className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-xs font-medium disabled:opacity-50">
                      {editLoading ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Stock: {p.stock} units</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-indigo-600">Rs {Number(p.price).toFixed(0)}</span>
                    <button onClick={() => { setEditId(p.id); setEditPrice(""); setEditStock(""); }}
                      className="text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {hasMore && (
            <button onClick={() => { setLoadingMore(true); fetchProducts(search, cursor, true).finally(() => setLoadingMore(false)); }}
              disabled={loadingMore}
              className="w-full mt-2 py-2.5 text-sm text-indigo-600 font-medium rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors disabled:opacity-50">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
