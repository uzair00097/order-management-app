"use client";
import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { v4 as uuidv4 } from "uuid";

type Customer = { id: string; name: string; address: string; phone?: string; creditLimit: number };

export default function DistributorCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("0");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchCustomers = useCallback(async (searchVal: string, cursorVal: string | null, append: boolean) => {
    const params = new URLSearchParams({ limit: "20" });
    if (searchVal) params.set("search", searchVal);
    if (cursorVal) params.set("cursor", cursorVal);
    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers((prev) => (append ? [...prev, ...data.data] : data.data));
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCustomers(search, null, false).finally(() => setLoading(false));
  }, [search, fetchCustomers]);

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
      body: JSON.stringify({
        name: newName,
        address: newAddress,
        phone: newPhone || undefined,
        creditLimit: parseFloat(newCreditLimit) || 0,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setAddError(err.error?.message ?? "Failed to add customer.");
    } else {
      setShowAdd(false);
      setNewName(""); setNewAddress(""); setNewPhone(""); setNewCreditLimit("0");
      await fetchCustomers(search, null, false);
    }
    setAddLoading(false);
  }

  function openEdit(c: Customer) {
    setEditingCustomer(c);
    setEditCreditLimit(String(Number(c.creditLimit)));
    setEditError("");
  }

  async function updateCreditLimit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditLoading(true);
    setEditError("");

    const res = await fetch(`/api/customers/${editingCustomer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditLimit: parseFloat(editCreditLimit) || 0 }),
    });

    if (!res.ok) {
      const err = await res.json();
      setEditError(err.error?.message ?? "Failed to update.");
    } else {
      setEditingCustomer(null);
      await fetchCustomers(search, null, false);
    }
    setEditLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Customers</h1>
        <button onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          + Add
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold mb-4">Add Customer</h2>
            {addError && <p className="text-sm text-red-600 mb-3">{addError}</p>}
            <form onSubmit={addCustomer} className="space-y-3">
              <input required placeholder="Shop name" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input required placeholder="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Credit Limit (PKR)</label>
                <input type="number" min="0" step="0.01" value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
                <button type="submit" disabled={addLoading}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                  {addLoading ? "Adding…" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCustomer && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold mb-1">Edit Credit Limit</h2>
            <p className="text-sm text-gray-500 mb-4">{editingCustomer.name}</p>
            {editError && <p className="text-sm text-red-600 mb-3">{editError}</p>}
            <form onSubmit={updateCreditLimit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Credit Limit (PKR)</label>
                <input type="number" min="0" step="0.01" value={editCreditLimit}
                  onChange={(e) => setEditCreditLimit(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingCustomer(null)}
                  className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
                <button type="submit" disabled={editLoading}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                  {editLoading ? "Saving…" : "Save"}
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
        <input type="search" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No customers found</div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.address}</p>
                {c.phone && <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>}
                <p className="text-xs text-indigo-600 mt-1 font-medium">
                  Limit: PKR {Number(c.creditLimit).toLocaleString("en-PK", { minimumFractionDigits: 0 })}
                </p>
              </div>
              <button onClick={() => openEdit(c)}
                className="shrink-0 text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition-colors">
                Edit Limit
              </button>
            </div>
          ))}

          {hasMore && (
            <button onClick={() => { setLoadingMore(true); fetchCustomers(search, cursor, true).finally(() => setLoadingMore(false)); }}
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
