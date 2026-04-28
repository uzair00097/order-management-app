"use client";
import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { v4 as uuidv4 } from "uuid";

type OrderStatus = "PENDING" | "APPROVED" | "DELIVERED" | "CANCELLED";

type Order = {
  id: string;
  status: string;
  createdAt: string;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
  customer: { id: string; name: string };
  salesman: { id: string; name: string };
  items: { quantity: number; unitPrice: number; product: { name: string } }[];
};

const STATUS_FILTERS: (OrderStatus | "ALL")[] = ["ALL", "PENDING", "APPROVED", "DELIVERED", "CANCELLED"];

export default function DistributorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("PENDING");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>("");

  const fetchOrders = useCallback(async (status: OrderStatus | "ALL", cursorVal: string | null, append: boolean) => {
    const params = new URLSearchParams({ limit: "20" });
    if (status !== "ALL") params.set("status", status);
    if (cursorVal) params.set("cursor", cursorVal);

    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders((prev) => (append ? [...prev, ...data.data] : data.data));
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
  }, []);

  useEffect(() => {
    setLoading(true);
    setActionError("");
    fetchOrders(statusFilter, null, false).finally(() => setLoading(false));
  }, [statusFilter, fetchOrders]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    await fetchOrders(statusFilter, cursor, true);
    setLoadingMore(false);
  }

  async function updateStatus(orderId: string, status: string) {
    setActionLoading(orderId);
    setActionError("");

    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": uuidv4(),
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const err = await res.json();
      setActionError(err.error?.message ?? "Action failed.");
    } else {
      // Refresh list
      await fetchOrders(statusFilter, null, false);
    }
    setActionLoading(null);
  }

  function orderTotal(order: Order) {
    return order.items.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Order Queue</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No orders</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{order.customer.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {order.salesman.name} · {new Date(order.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="space-y-1 mb-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600">
                    <span>{item.product.name} × {item.quantity}</span>
                    <span>Rs {(item.quantity * Number(item.unitPrice)).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center border-t border-gray-100 pt-2 mb-3">
                <span className="text-xs text-gray-500">Total</span>
                <span className="text-sm font-semibold">Rs {orderTotal(order).toFixed(0)}</span>
              </div>

              {order.notes && (
                <p className="text-xs text-gray-500 italic mb-3">&quot;{order.notes}&quot;</p>
              )}

              {/* Location + invoice row */}
              <div className="flex items-center justify-between mb-3">
                {order.lat && order.lng ? (
                  <a
                    href={`https://www.google.com/maps?q=${Number(order.lat).toFixed(6)},${Number(order.lng).toFixed(6)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    View location
                  </a>
                ) : <span />}
                <a
                  href={`/api/orders/${order.id}/invoice`}
                  download
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Invoice
                </a>
              </div>

              {/* Action buttons */}
              {order.status === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(order.id, "APPROVED")}
                    disabled={actionLoading === order.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading === order.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => updateStatus(order.id, "CANCELLED")}
                    disabled={actionLoading === order.id}
                    className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}

              {order.status === "APPROVED" && (
                <button
                  onClick={() => updateStatus(order.id, "DELIVERED")}
                  disabled={actionLoading === order.id}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === order.id ? "…" : "Mark Delivered"}
                </button>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 text-sm text-indigo-600 font-medium rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
