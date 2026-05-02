"use client";
import { useState, useEffect, useCallback } from "react";
import { SkeletonStatCards } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";

type OrderItem = { productName: string; quantity: number; unitPrice: number; amount: number };
type DSROrder = {
  id: string;
  status: string;
  createdAt: string;
  total: number;
  discountAmount: number;
  notes?: string | null;
  customer: { name: string };
  salesman: { name: string };
  items: OrderItem[];
};
type SalesmanRow = { id: string; name: string; orderCount: number; revenue: number };
type ProductRow = { id: string; name: string; quantitySold: number; revenue: number };
type DSRData = {
  date: string;
  summary: { totalOrders: number; totalRevenue: number; statusBreakdown: Record<string, number> };
  bySalesman: SalesmanRow[];
  byProduct: ProductRow[];
  orders: DSROrder[];
};

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number) {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export default function DSRPage() {
  const [date, setDate] = useState(todayUTC);
  const [data, setData] = useState<DSRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const fetchDSR = useCallback(async (d: string) => {
    setLoading(true);
    setData(null);
    const res = await fetch(`/api/dsr?date=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchDSR(date); }, [date, fetchDSR]);

  async function downloadPdf() {
    setPdfLoading(true);
    const res = await fetch(`/api/dsr/pdf?date=${date}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsr-${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setPdfLoading(false);
  }

  const sb = data?.summary.statusBreakdown ?? {};

  return (
    <div className="pb-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 gap-2">
        <h1 className="text-xl font-bold text-gray-900 shrink-0 tracking-tight">Daily Sales Report</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 bg-white"
          />
          <button
            onClick={downloadPdf}
            disabled={pdfLoading || loading || !data}
            className="flex items-center gap-1.5 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
          >
            {pdfLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonStatCards cols={4} />
          <SkeletonStatCards cols={4} />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400 text-sm">Failed to load report</div>
      ) : data.summary.totalOrders === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">No orders on {date}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Gradient summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="animate-fade-up rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 p-4 shadow-lg shadow-purple-900/20">
              <p className="text-2xl font-bold text-white">{data.summary.totalOrders}</p>
              <p className="text-xs text-purple-200 mt-1">Total Orders</p>
            </div>
            <div className="animate-fade-up-1 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 shadow-lg shadow-emerald-900/20">
              <p className="text-lg font-bold text-white leading-tight">{fmt(data.summary.totalRevenue)}</p>
              <p className="text-xs text-emerald-100 mt-1">Active Revenue</p>
            </div>
            <div className="animate-fade-up-2 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-4 shadow-lg shadow-orange-900/20">
              <p className="text-2xl font-bold text-white">{sb["PENDING"] ?? 0}</p>
              <p className="text-xs text-amber-100 mt-1">Pending</p>
            </div>
            <div className="animate-fade-up-3 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 p-4 shadow-lg shadow-purple-900/20">
              <p className="text-2xl font-bold text-white">{sb["DELIVERED"] ?? 0}</p>
              <p className="text-xs text-sky-100 mt-1">Delivered</p>
            </div>
          </div>

          {/* Status breakdown pills */}
          <div className="flex flex-wrap gap-2">
            {(["PENDING", "APPROVED", "DELIVERED", "CANCELLED", "DRAFT"] as const).map((s) =>
              sb[s] ? (
                <div key={s} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1">
                  <StatusBadge status={s} />
                  <span className="text-xs font-semibold text-gray-700">{sb[s]}</span>
                </div>
              ) : null
            )}
          </div>

          {/* By Salesman */}
          {data.bySalesman.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Sales by Salesman</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {data.bySalesman.map((row) => (
                  <div key={row.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{row.orderCount} order{row.orderCount !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-sm font-semibold text-purple-800">{fmt(row.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Product — with revenue bars */}
          {data.byProduct.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Top Products</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {data.byProduct.map((row, i) => {
                  const maxRev = data.byProduct[0].revenue;
                  const pct = maxRev > 0 ? Math.round((row.revenue / maxRev) * 100) : 0;
                  return (
                    <div key={row.id} className="px-4 py-3">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="w-5 text-xs text-gray-400 font-bold shrink-0">{i + 1}</span>
                        <p className="text-sm font-medium text-gray-900 flex-1 truncate">{row.name}</p>
                        <p className="text-sm font-semibold text-gray-800 shrink-0">{fmt(row.revenue)}</p>
                      </div>
                      <div className="ml-8 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-700 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{row.quantitySold} units</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Orders</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {data.orders.map((order) => (
                <div key={order.id}>
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{order.customer.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {order.salesman.name} · {new Date(order.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={order.status} />
                      <p className="text-sm font-semibold text-gray-800">{fmt(order.total)}</p>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${expandedOrder === order.id ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {expandedOrder === order.id && (
                    <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                      <div className="space-y-1.5 mt-2">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-600">
                            <span className="flex-1 truncate mr-2">{item.productName} × {item.quantity}</span>
                            <span className="shrink-0">{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                      {order.discountAmount > 0 && (
                        <div className="flex justify-between text-xs text-green-600 mt-1.5">
                          <span>Discount</span>
                          <span>− {fmt(order.discountAmount)}</span>
                        </div>
                      )}
                      {order.notes && (
                        <p className="text-xs text-gray-400 italic mt-2">&quot;{order.notes}&quot;</p>
                      )}
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs text-gray-500">Total</span>
                        <span className="text-sm font-semibold text-gray-900">{fmt(order.total)}</span>
                      </div>
                      <div className="mt-2">
                        <a
                          href={`/api/orders/${order.id}/invoice`}
                          download
                          className="text-xs text-purple-700 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Invoice
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
