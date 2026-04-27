"use client";
import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { v4 as uuidv4 } from "uuid";

type OrderStatus = "DRAFT" | "PENDING" | "APPROVED" | "DELIVERED" | "CANCELLED";

type Order = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  customer: { id: string; name: string };
  items: { quantity: number; unitPrice: number; product: { name: string } }[];
};

const STATUS_FILTERS: (OrderStatus | "ALL")[] = ["ALL", "DRAFT", "PENDING", "APPROVED", "DELIVERED", "CANCELLED"];

export default function SalesmanOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");

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
    fetchOrders(statusFilter, null, false).finally(() => setLoading(false));
  }, [statusFilter, fetchOrders]);

  async function cancelOrder(orderId: string) {
    setCancellingId(orderId);
    setCancelError("");
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": uuidv4(),
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (!res.ok) {
      const err = await res.json();
      setCancelError(err.error?.message ?? "Failed to cancel order.");
    } else {
      await fetchOrders(statusFilter, null, false);
    }
    setCancellingId(null);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    await fetchOrders(statusFilter, cursor, true);
    setLoadingMore(false);
  }

  function orderTotal(order: Order) {
    return order.items.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">My Orders</h1>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {cancelError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {cancelError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No orders found</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.customer.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString("en-PK", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600">
                    <span>{item.product.name} × {item.quantity}</span>
                    <span>Rs {(item.quantity * Number(item.unitPrice)).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-500">Total</span>
                <span className="text-sm font-semibold text-gray-900">Rs {orderTotal(order).toFixed(0)}</span>
              </div>

              {order.status === "DRAFT" && (
                <button
                  onClick={() => cancelOrder(order.id)}
                  disabled={cancellingId === order.id}
                  className="mt-3 w-full border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {cancellingId === order.id ? "Cancelling…" : "Cancel Order"}
                </button>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 text-sm text-blue-600 font-medium rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
