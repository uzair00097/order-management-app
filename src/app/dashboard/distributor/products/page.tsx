"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";

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

export default function DistributorProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Add product modal
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const addFileRef = useRef<HTMLInputElement>(null);

  // Edit product modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

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

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    return ((await res.json()) as { url: string }).url;
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");

    let imageUrl: string | undefined;
    if (newImageFile) {
      const url = await uploadImage(newImageFile);
      if (!url) { setAddError("Image upload failed. Please try again."); setAddLoading(false); return; }
      imageUrl = url;
    }

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
      body: JSON.stringify({ name: newName, price: parseFloat(newPrice), stock: parseInt(newStock), ...(imageUrl ? { imageUrl } : {}) }),
    });

    if (!res.ok) {
      const err = await res.json();
      setAddError(err.error?.message ?? "Failed to add product.");
    } else {
      setShowAdd(false);
      setNewName(""); setNewPrice(""); setNewStock("");
      setNewImageFile(null); setNewImagePreview(null);
      await fetchProducts(search, null, false);
    }
    setAddLoading(false);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setEditPrice("");
    setEditStock("");
    setEditImageFile(null);
    setEditImagePreview(p.imageUrl);
  }

  async function saveEdit() {
    if (!editProduct) return;
    setEditLoading(true);
    const body: Record<string, number | string | null> = {};
    if (editPrice) body.price = parseFloat(editPrice);
    if (editStock) body.stock = parseInt(editStock);
    if (editImageFile) {
      const url = await uploadImage(editImageFile);
      if (url) body.imageUrl = url;
    }

    await fetch(`/api/products/${editProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setEditProduct(null);
    setEditImageFile(null);
    setEditImagePreview(null);
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
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
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
              <div>
                <input ref={addFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setNewImageFile(f);
                  setNewImagePreview(f ? URL.createObjectURL(f) : null);
                }} />
                {newImagePreview ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-gray-200">
                    <Image src={newImagePreview} alt="Preview" fill className="object-cover" unoptimized />
                    <button type="button" onClick={() => { setNewImageFile(null); setNewImagePreview(null); if (addFileRef.current) addFileRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => addFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg py-6 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                    + Add product image (optional)
                  </button>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAdd(false); setNewImageFile(null); setNewImagePreview(null); }}
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

      {/* Edit product modal */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold mb-1">Edit Product</h2>
            <p className="text-xs text-gray-500 mb-4">{editProduct.name}</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input type="number" min="0" step="0.01" placeholder={`Price: ${Number(editProduct.price).toFixed(0)}`}
                  value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="number" min="0" placeholder={`Stock: ${editProduct.stock}`}
                  value={editStock} onChange={(e) => setEditStock(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setEditImageFile(f);
                  setEditImagePreview(f ? URL.createObjectURL(f) : null);
                }} />
                {editImagePreview ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-gray-200">
                    <Image src={editImagePreview} alt="Preview" fill className="object-cover" unoptimized />
                    <button type="button" onClick={() => { setEditImageFile(null); setEditImagePreview(null); if (editFileRef.current) editFileRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => editFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg py-5 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                    + Change image
                  </button>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setEditProduct(null); setEditImageFile(null); setEditImagePreview(null); }}
                  className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
                <button onClick={saveEdit} disabled={editLoading}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
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
        <>
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="relative">
                  <ProductImage imageUrl={p.imageUrl} name={p.name} />
                  <button
                    onClick={() => openEdit(p)}
                    className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow text-gray-500 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.stock > 0 ? `${p.stock} units` : <span className="text-red-400">Out of stock</span>}
                  </p>
                  <p className="text-sm font-bold text-indigo-600 mt-1">Rs {Number(p.price).toFixed(0)}</p>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button onClick={() => { setLoadingMore(true); fetchProducts(search, cursor, true).finally(() => setLoadingMore(false)); }}
              disabled={loadingMore}
              className="w-full mt-4 py-2.5 text-sm text-indigo-600 font-medium rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors disabled:opacity-50">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
