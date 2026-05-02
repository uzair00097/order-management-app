"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/contexts/toast";
import { v4 as uuidv4 } from "uuid";

type Product = { id: string; name: string; price: number; stock: number; imageUrl: string | null };
type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";
type ViewMode = "grid" | "list";

function stockLabel(stock: number): { label: string; className: string } {
  if (stock === 0) return { label: "Out of stock", className: "bg-red-100 text-red-600" };
  if (stock <= 10) return { label: `Low · ${stock}`, className: "bg-orange-100 text-orange-600" };
  if (stock <= 30) return { label: `${stock} units`, className: "bg-amber-100 text-amber-700" };
  return { label: `${stock} units`, className: "bg-emerald-100 text-emerald-700" };
}

function ProductImage({ imageUrl, name, className = "" }: { imageUrl: string | null; name: string; className?: string }) {
  return (
    <div className={`bg-gradient-to-br from-purple-50 to-gray-100 overflow-hidden ${className}`}>
      <div className="relative w-full h-full">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <svg className="w-8 h-8 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "price-desc", label: "Price High–Low" },
  { value: "price-asc", label: "Price Low–High" },
  { value: "stock-asc", label: "Stock Low–High" },
  { value: "stock-desc", label: "Stock High–Low" },
];

function sortProducts(products: Product[], sort: SortKey): Product[] {
  return [...products].sort((a, b) => {
    switch (sort) {
      case "name-asc":   return a.name.localeCompare(b.name);
      case "name-desc":  return b.name.localeCompare(a.name);
      case "price-asc":  return Number(a.price) - Number(b.price);
      case "price-desc": return Number(b.price) - Number(a.price);
      case "stock-asc":  return a.stock - b.stock;
      case "stock-desc": return b.stock - a.stock;
    }
  });
}

export default function DistributorProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSort, setShowSort] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async (searchVal: string, cursorVal: string | null, append: boolean) => {
    const params = new URLSearchParams({ limit: "50" });
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

  const sorted = useMemo(() => sortProducts(products, sort), [products, sort]);

  const stats = useMemo(() => ({
    total: products.length,
    outOfStock: products.filter((p) => p.stock === 0).length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= 10).length,
  }), [products]);

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
    let imageUrl: string | undefined;
    if (newImageFile) {
      const url = await uploadImage(newImageFile);
      if (!url) { toast.show("Image upload failed.", "error"); setAddLoading(false); return; }
      imageUrl = url;
    }
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
      body: JSON.stringify({ name: newName, price: parseFloat(newPrice), stock: parseInt(newStock), ...(imageUrl ? { imageUrl } : {}) }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.show(err.error?.message ?? "Failed to add product.", "error");
    } else {
      setShowAdd(false);
      setNewName(""); setNewPrice(""); setNewStock("");
      setNewImageFile(null); setNewImagePreview(null);
      await fetchProducts(search, null, false);
      toast.show("Product added successfully.");
    }
    setAddLoading(false);
  }

  async function confirmDelete() {
    if (!deleteProduct) return;
    setDeleteLoading(true);
    await fetch(`/api/products/${deleteProduct.id}`, { method: "DELETE" });
    setDeleteProduct(null);
    setDeleteLoading(false);
    await fetchProducts(search, null, false);
    toast.show("Product removed.", "info");
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
    const res = await fetch(`/api/products/${editProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.show(err.error?.message ?? "Failed to update product.", "error");
    } else {
      setEditProduct(null);
      setEditImageFile(null);
      setEditImagePreview(null);
      await fetchProducts(search, null, false);
      toast.show("Product updated.");
    }
    setEditLoading(false);
  }

  const modalBase = "fixed inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-end md:items-center justify-center animate-fade-in";
  const sheet = "bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg p-6 animate-slide-up-modal max-h-[90vh] overflow-y-auto";
  const input = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 focus:border-transparent bg-gray-50/50";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products</h1>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.total} total
              {stats.outOfStock > 0 && <span className="text-red-500"> · {stats.outOfStock} out of stock</span>}
              {stats.lowStock > 0 && <span className="text-orange-500"> · {stats.lowStock} low stock</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-press bg-purple-800 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-purple-900 transition-colors shadow-sm shadow-purple-900/20"
        >
          + Add
        </button>
      </div>

      {/* Search + controls row */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 focus:border-transparent bg-white"
          />
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white hover:border-purple-300 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 w-44 py-1 animate-fade-up">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSort(opt.value); setShowSort(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${sort === opt.value ? "text-purple-800 bg-purple-50" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-2.5 py-2.5 transition-colors ${viewMode === "grid" ? "bg-purple-800 text-white" : "text-gray-400 hover:text-gray-600"}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-2.5 py-2.5 transition-colors ${viewMode === "list" ? "bg-purple-800 text-white" : "text-gray-400 hover:text-gray-600"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className={modalBase}>
          <div className={sheet}>
            <h2 className="text-base font-semibold mb-1">Add Product</h2>
            <p className="text-xs text-gray-400 mb-4">Fill in the product details</p>
            <form onSubmit={addProduct} className="space-y-3">
              <input required placeholder="Product name" value={newName} onChange={(e) => setNewName(e.target.value)} className={input} />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Price (Rs)</label>
                  <input required type="number" min="0" step="0.01" placeholder="0.00" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={input} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Stock</label>
                  <input required type="number" min="0" placeholder="0" value={newStock} onChange={(e) => setNewStock(e.target.value)} className={input} />
                </div>
              </div>
              <div>
                <input ref={addFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setNewImageFile(f);
                  setNewImagePreview(f ? URL.createObjectURL(f) : null);
                }} />
                {newImagePreview ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200">
                    <Image src={newImagePreview} alt="Preview" fill className="object-cover" unoptimized />
                    <button type="button" onClick={() => { setNewImageFile(null); setNewImagePreview(null); if (addFileRef.current) addFileRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow text-gray-500 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => addFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-400 hover:border-purple-600 hover:text-purple-700 transition-colors flex flex-col items-center gap-1.5">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Add product image (optional)
                  </button>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAdd(false); setNewImageFile(null); setNewImagePreview(null); }}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={addLoading}
                  className="btn-press flex-1 bg-purple-800 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-purple-900">
                  {addLoading ? "Adding…" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteProduct && (
        <div className={modalBase}>
          <div className={sheet}>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Delete Product?</h2>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-800">{deleteProduct.name}</span> will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteProduct(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteLoading}
                className="btn-press flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 transition-colors">
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editProduct && (
        <div className={modalBase}>
          <div className={sheet}>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                <ProductImage imageUrl={editProduct.imageUrl} name={editProduct.name} className="w-12 h-12 rounded-xl" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Edit Product</h2>
                <p className="text-xs text-gray-400 truncate max-w-[220px]">{editProduct.name}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Price (Rs)</label>
                  <input type="number" min="0" step="0.01" placeholder={Number(editProduct.price).toFixed(0)}
                    value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className={input} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Stock</label>
                  <input type="number" min="0" placeholder={String(editProduct.stock)}
                    value={editStock} onChange={(e) => setEditStock(e.target.value)} className={input} />
                </div>
              </div>
              <div>
                <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setEditImageFile(f);
                  setEditImagePreview(f ? URL.createObjectURL(f) : null);
                }} />
                {editImagePreview ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200">
                    <Image src={editImagePreview} alt="Preview" fill className="object-cover" unoptimized />
                    <button type="button" onClick={() => { setEditImageFile(null); setEditImagePreview(null); if (editFileRef.current) editFileRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow text-gray-500 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => editFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-400 hover:border-purple-600 hover:text-purple-700 transition-colors flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Change image
                  </button>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setEditProduct(null); setEditImageFile(null); setEditImagePreview(null); }}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveEdit} disabled={editLoading}
                  className="btn-press flex-1 bg-purple-800 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-purple-900">
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <SkeletonList count={6} variant="card" />
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">No products found</p>
          {search && <p className="text-xs text-gray-300 mt-1">Try a different search term</p>}
          {!search && (
            <button onClick={() => setShowAdd(true)} className="mt-3 text-xs text-purple-700 font-medium hover:underline">
              + Add your first product
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {sorted.map((p, i) => {
              const stock = stockLabel(p.stock);
              return (
                <div
                  key={p.id}
                  className="animate-fade-up bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-soft card-interactive group"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="relative aspect-square">
                    <ProductImage imageUrl={p.imageUrl} name={p.name} className="absolute inset-0" />
                    {p.stock === 0 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-xs font-bold bg-red-600 px-2 py-0.5 rounded-full">Out of Stock</span>
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)}
                        className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm text-gray-500 hover:text-purple-800 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteProduct(p)}
                        className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm text-gray-500 hover:text-red-500 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 truncate leading-snug">{p.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-base font-bold text-purple-800">Rs {Number(p.price).toLocaleString("en-PK", { maximumFractionDigits: 0 })}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stock.className}`}>{stock.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button onClick={() => { setLoadingMore(true); fetchProducts(search, cursor, true).finally(() => setLoadingMore(false)); }}
              disabled={loadingMore}
              className="w-full mt-4 py-2.5 text-sm text-purple-800 font-medium rounded-xl border border-purple-200 hover:bg-purple-50 transition-colors disabled:opacity-50">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      ) : (
        /* List view */
        <div className="space-y-2">
          {sorted.map((p, i) => {
            const stock = stockLabel(p.stock);
            return (
              <div
                key={p.id}
                className="animate-fade-up bg-white rounded-xl border border-gray-200 flex items-center gap-3 p-3 hover:border-purple-200 hover:shadow-sm transition-all"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  <ProductImage imageUrl={p.imageUrl} name={p.name} className="absolute inset-0" />
                  {p.stock === 0 && <div className="absolute inset-0 bg-black/30 rounded-xl" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-bold text-purple-800">Rs {Number(p.price).toLocaleString("en-PK", { maximumFractionDigits: 0 })}</p>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${stock.className}`}>{stock.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-2 rounded-xl text-purple-700 hover:bg-purple-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeleteProduct(p)} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button onClick={() => { setLoadingMore(true); fetchProducts(search, cursor, true).finally(() => setLoadingMore(false)); }}
              disabled={loadingMore}
              className="w-full py-2.5 text-sm text-purple-800 font-medium rounded-xl border border-purple-200 hover:bg-purple-50 transition-colors disabled:opacity-50">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
