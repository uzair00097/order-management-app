"use client";
import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/Spinner";
import Image from "next/image";

type Product = { id: string; name: string; price: number; stock: number; imageUrl: string | null };

function ProductImage({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div className="w-full aspect-square bg-gray-100 overflow-hidden">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={200} height={200} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
    </div>
  );
}

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
        <>
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <ProductImage imageUrl={p.imageUrl} name={p.name} />
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.stock > 0 ? `${p.stock} units` : <span className="text-red-400">Out of stock</span>}
                  </p>
                  <p className="text-sm font-bold text-blue-600 mt-1">Rs {Number(p.price).toFixed(0)}</p>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => { setLoadingMore(true); fetchProducts(search, cursor, true).finally(() => setLoadingMore(false)); }}
              disabled={loadingMore}
              className="w-full mt-4 py-2.5 text-sm text-blue-600 font-medium rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
