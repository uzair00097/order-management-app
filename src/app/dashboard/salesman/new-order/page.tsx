"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/contexts/locale";
import {
  saveCart, loadCart, clearCart,
  queuePendingOrder, hasPendingOrders,
  getPendingOrders, removePendingOrder,
  type SavedCart,
} from "@/lib/idb";

type Customer = { id: string; name: string; address: string; phone?: string };
type Product = { id: string; name: string; price: number; stock: number };
type CartItem = { product: Product; quantity: number };
type Step = "customer" | "products" | "confirm";

export default function NewOrderPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [step, setStep] = useState<Step>("customer");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Products & cart
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Submission
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [queued, setQueued] = useState(false);

  // Offline & sync state
  const [isOnline, setIsOnline] = useState(true);
  const [hasPending, setHasPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<"success" | "error" | null>(null);

  const cartSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── GPS capture on mount (non-blocking, best-effort) ─────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // denied or unavailable — silent
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // ── Online / offline detection ────────────────────────────────────────────
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  // ── Listen for SW sync messages ───────────────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_ORDER_SUCCESS" || event.data?.type === "SYNC_COMPLETE") {
        setSyncing(false);
        setSyncResult("success");
        setHasPending(false);
        setTimeout(() => setSyncResult(null), 4000);
      }
      if (event.data?.type === "SYNC_ORDER_FAILED") {
        setSyncing(false);
        setSyncResult("error");
        setTimeout(() => setSyncResult(null), 5000);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // ── Restore cart from IndexedDB on mount ──────────────────────────────────
  useEffect(() => {
    loadCart().then((saved) => {
      if (!saved) return;
      setSelectedCustomer(saved.customer);
      setCart(saved.items);
      setNotes(saved.notes);
      if (saved.items.length > 0) setStep("products");
    }).catch(() => {});

    hasPendingOrders().then(setHasPending).catch(() => {});
  }, []);

  // ── Auto-save cart to IndexedDB on changes ────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) return;
    if (cartSaveTimer.current) clearTimeout(cartSaveTimer.current);
    cartSaveTimer.current = setTimeout(() => {
      const data: SavedCart = {
        customer: selectedCustomer,
        customerId: selectedCustomer.id,
        items: cart,
        notes,
      };
      saveCart(data).catch(() => {});
    }, 500);
    return () => { if (cartSaveTimer.current) clearTimeout(cartSaveTimer.current); };
  }, [selectedCustomer, cart, notes]);

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async (search: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers(data.data ?? []);
  }, []);

  const fetchProducts = useCallback(async (search: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(data.data ?? []);
  }, []);

  useEffect(() => {
    setLoadingCustomers(true);
    fetchCustomers(debouncedCustomerSearch).finally(() => setLoadingCustomers(false));
  }, [debouncedCustomerSearch, fetchCustomers]);

  useEffect(() => {
    if (step !== "products") return;
    setLoadingProducts(true);
    fetchProducts(debouncedProductSearch).finally(() => setLoadingProducts(false));
  }, [debouncedProductSearch, step, fetchProducts]);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  function updateCart(product: Product, quantity: number) {
    setCart((prev) => {
      if (quantity === 0) return prev.filter((c) => c.product.id !== product.id);
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) return prev.map((c) => c.product.id === product.id ? { ...c, quantity } : c);
      return [...prev, { product, quantity }];
    });
  }

  function cartQty(productId: string) {
    return cart.find((c) => c.product.id === productId)?.quantity ?? 0;
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * Number(c.product.price), 0);

  // ── Manual sync trigger ───────────────────────────────────────────────────
  async function triggerSync() {
    setSyncing(true);
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      await (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
        .sync.register("sync-orders").catch(() => {});
    } else {
      reg.active?.postMessage({ type: "SYNC_NOW" });
    }

    // Fallback: if SW messages don't arrive, sync directly from page
    try {
      const pending = await getPendingOrders();
      for (const po of pending) {
        let orderId = po.orderId;
        if (!orderId) {
          const r = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": po.idemKey1 },
            body: JSON.stringify({ customerId: po.customerId, items: po.items, notes: po.notes }),
          });
          if (!r.ok) { await removePendingOrder(po.id); continue; }
          orderId = (await r.json()).id;
        }
        const r2 = await fetch(`/api/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Idempotency-Key": po.idemKey2 },
          body: JSON.stringify({ status: "PENDING" }),
        });
        if (r2.ok) await removePendingOrder(po.id);
      }
      setHasPending(await hasPendingOrders());
      setSyncing(false);
      setSyncResult("success");
      setTimeout(() => setSyncResult(null), 4000);
    } catch {
      setSyncing(false);
      setSyncResult("error");
    }
  }

  // ── Submit order ──────────────────────────────────────────────────────────
  async function submitOrder() {
    if (!selectedCustomer || cart.length === 0) return;
    setSubmitting(true);
    setSubmitError("");

    const idemKey1 = uuidv4();
    const idemKey2 = uuidv4();

    // If offline, queue immediately without attempting the network call
    if (!navigator.onLine) {
      await queuePendingOrder({
        id: uuidv4(),
        idemKey1,
        idemKey2,
        customerId: selectedCustomer.id,
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        notes: notes || undefined,
        orderId: null,
        createdAt: Date.now(),
      });
      await clearCart();
      setQueued(true);
      setSubmitting(false);
      setHasPending(true);
      return;
    }

    try {
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey1 },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
          notes: notes || undefined,
          ...(location ? { lat: location.lat, lng: location.lng } : {}),
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        setSubmitError(err.error?.message ?? "Failed to save order. Please retry.");
        setSubmitting(false);
        return;
      }

      const { id: orderId } = await createRes.json();

      const submitRes = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey2 },
        body: JSON.stringify({ status: "PENDING" }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json();
        setSubmitError(err.error?.message ?? "Failed to submit order. Please retry.");
        setSubmitting(false);
        return;
      }

      await clearCart();
      router.push("/dashboard/salesman/orders");
    } catch {
      // Network error — queue the order for background sync
      await queuePendingOrder({
        id: uuidv4(),
        idemKey1,
        idemKey2,
        customerId: selectedCustomer.id,
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        notes: notes || undefined,
        orderId: null,
        createdAt: Date.now(),
      });
      await clearCart();
      setQueued(true);
      setHasPending(true);
      setSubmitting(false);
    }
  }

  // ── Queued confirmation screen ────────────────────────────────────────────
  if (queued) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">{t("orderQueued")}</h2>
        <p className="text-sm text-gray-500 mb-6">{t("orderQueuedDesc")}</p>
        <button onClick={() => router.push("/dashboard/salesman/orders")}
          className="text-sm text-blue-600 font-medium underline">{t("orders")}</button>
      </div>
    );
  }

  return (
    <div>
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
          <p className="text-xs text-yellow-800 font-medium">{t("offlineBanner")}</p>
        </div>
      )}

      {/* Pending sync banner */}
      {hasPending && isOnline && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-2">
          <p className="text-xs text-blue-800 font-medium">{t("pendingSyncBanner")}</p>
          <button onClick={triggerSync} disabled={syncing}
            className="text-xs text-blue-700 font-semibold underline disabled:opacity-50 flex-shrink-0">
            {syncing ? t("syncing") : t("syncNow")}
          </button>
        </div>
      )}

      {/* Sync result */}
      {syncResult === "success" && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-green-800 font-medium">
          ✓ {t("syncSuccess")}
        </div>
      )}
      {syncResult === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-red-700 font-medium">
          {t("syncError")}
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(["customer", "products", "confirm"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s ? "bg-blue-600 text-white" : i < ["customer","products","confirm"].indexOf(step) ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {i < ["customer","products","confirm"].indexOf(step) ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium ${step === s ? "text-blue-600" : "text-gray-400"}`}>
              {s === "customer" ? "Customer" : s === "products" ? "Products" : "Confirm"}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Customer selection */}
      {step === "customer" && (
        <div>
          <h1 className="text-lg font-semibold mb-4">{t("selectCustomer")}</h1>
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input type="search" placeholder={t("searchCustomers")} value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>

          {loadingCustomers ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : customers.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">{t("noCustomersFound")}</p>
          ) : (
            <div className="space-y-2">
              {customers.map((c) => (
                <button key={c.id} onClick={() => { setSelectedCustomer(c); setStep("products"); }}
                  className="w-full text-left bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Product selection */}
      {step === "products" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep("customer")} className="text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold leading-none">Add Products</h1>
              <p className="text-xs text-gray-500 mt-0.5">{selectedCustomer?.name}</p>
            </div>
          </div>

          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input type="search" placeholder={t("searchProducts")} value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>

          {loadingProducts ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <div className="space-y-2 mb-24">
              {products.map((p) => {
                const qty = cartQty(p.id);
                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">Rs {Number(p.price).toFixed(0)} · Stock: {p.stock}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {qty > 0 ? (
                        <>
                          <button onClick={() => updateCart(p, qty - 1)}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium text-lg leading-none">−</button>
                          <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                          <button onClick={() => updateCart(p, qty + 1)} disabled={qty >= p.stock}
                            className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-lg leading-none disabled:bg-gray-200">+</button>
                        </>
                      ) : (
                        <button onClick={() => updateCart(p, 1)} disabled={p.stock === 0}
                          className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-lg leading-none disabled:bg-gray-200">+</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <div className="fixed bottom-20 left-0 right-0 px-4 z-10">
              <div className="max-w-lg mx-auto">
                <button onClick={() => setStep("confirm")}
                  className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium text-sm flex items-center justify-between px-5 shadow-lg">
                  <span>{cart.length} item{cart.length > 1 ? "s" : ""}</span>
                  <span>Review Order →</span>
                  <span>Rs {cartTotal.toFixed(0)}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm order */}
      {step === "confirm" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep("products")} className="text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">Confirm Order</h1>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <p className="text-xs text-gray-500 mb-1">{t("customers")}</p>
            <p className="text-sm font-medium text-gray-900">{selectedCustomer?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{selectedCustomer?.address}</p>
            {location && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t("locationGranted")}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <p className="text-xs text-gray-500 mb-3">{t("items")}</p>
            <div className="space-y-2">
              {cart.map((c) => (
                <div key={c.product.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{c.product.name} × {c.quantity}</span>
                  <span className="text-gray-900 font-medium">Rs {(c.quantity * Number(c.product.price)).toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm font-semibold">
              <span>{t("total")}</span>
              <span>Rs {cartTotal.toFixed(0)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <label className="text-xs text-gray-500 block mb-1">{t("notes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")} rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
              {submitError}
              <button onClick={submitOrder} className="ml-2 underline font-medium">Retry</button>
            </div>
          )}

          <button onClick={submitOrder} disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            {submitting && <Spinner className="h-4 w-4 text-white" />}
            {submitting ? t("submitting") : isOnline ? t("placeOrder") : t("saveOrderOffline")}
          </button>
        </div>
      )}
    </div>
  );
}
