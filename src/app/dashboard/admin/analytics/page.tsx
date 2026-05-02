"use client";
import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";

type Summary = {
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  totalUsers: number;
  totalDistributors: number;
  totalSalesmen: number;
};

type StatusCount = { status: string; count: number };
type DailyOrder = { date: string; count: number; total: number };

type AnalyticsData = {
  summary: Summary;
  ordersByStatus: StatusCount[];
  dailyOrders: DailyOrder[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-purple-100 text-purple-900",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError("Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  if (error || !data) {
    return <p className="text-center text-red-500 py-20 text-sm">{error || "No data"}</p>;
  }

  const { summary, ordersByStatus, dailyOrders } = data;

  const statCards = [
    { label: "Total Orders", value: summary.totalOrders },
    { label: "Today's Orders", value: summary.todayOrders },
    { label: "Pending", value: summary.pendingOrders, highlight: summary.pendingOrders > 0 },
    { label: "Total Users", value: summary.totalUsers },
    { label: "Distributors", value: summary.totalDistributors },
    { label: "Salesmen", value: summary.totalSalesmen },
  ];

  const totalDelivered = dailyOrders.reduce((sum, d) => sum + d.total, 0);
  const totalOrderCount = dailyOrders.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`bg-white rounded-xl border p-4 ${s.highlight ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}
          >
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.highlight ? "text-yellow-700" : "text-gray-900"}`}>
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Orders by status */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-900 mb-3">Orders by Status</p>
        <div className="space-y-2">
          {ordersByStatus.length === 0 ? (
            <p className="text-xs text-gray-400">No orders yet</p>
          ) : (
            ordersByStatus
              .sort((a, b) => b.count - a.count)
              .map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {s.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{s.count.toLocaleString()}</span>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Last 30 days */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900">Last 30 Days</p>
          <p className="text-xs text-gray-500">{totalOrderCount} orders · Rs {totalDelivered.toLocaleString("en-PK", { maximumFractionDigits: 0 })}</p>
        </div>

        {dailyOrders.length === 0 ? (
          <p className="text-xs text-gray-400">No completed orders in this period</p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-right pb-2 font-medium">Orders</th>
                  <th className="text-right pb-2 font-medium">Revenue (Rs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dailyOrders.map((d) => (
                  <tr key={d.date} className="text-gray-700">
                    <td className="py-2">
                      {new Date(d.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                    </td>
                    <td className="py-2 text-right font-medium">{d.count}</td>
                    <td className="py-2 text-right">{d.total.toLocaleString("en-PK", { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
