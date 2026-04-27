"use client";
import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/Spinner";

type Product = { id: string; name: string; price: number; stock: number };

export default function SalesmanProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    await fetchProducts(search, cursor, true);
    setLoadingMore(false);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Product Catalogue</h1>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No products found</div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Stock: {p.stock} units</p>
              </div>
              <span className="text-sm font-semibold text-blue-600">Rs {Number(p.price).toFixed(0)}</span>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full mt-2 py-2.5 text-sm text-blue-600 font-medium rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
