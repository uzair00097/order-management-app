"use client";
import { useState, useEffect, useCallback } from "react";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/contexts/toast";
import { v4 as uuidv4 } from "uuid";

type Customer = { id: string; name: string; address: string; phone?: string; creditLimit: number };

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const colors = [
    "from-purple-500 to-purple-700",
    "from-purple-400 to-purple-600",
    "from-violet-500 to-violet-700",
    "from-fuchsia-500 to-fuchsia-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
}

export default function DistributorCustomersPage() {
  const toast = useToast();
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

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
      body: JSON.stringify({ name: newName, address: newAddress, phone: newPhone || undefined, creditLimit: parseFloat(newCreditLimit) || 0 }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.show(err.error?.message ?? "Failed to add customer.", "error");
    } else {
      setShowAdd(false);
      setNewName(""); setNewAddress(""); setNewPhone(""); setNewCreditLimit("0");
      await fetchCustomers(search, null, false);
      toast.show("Customer added successfully.");
    }
    setAddLoading(false);
  }

  function openEdit(c: Customer) {
    setEditingCustomer(c);
    setEditCreditLimit(String(Number(c.creditLimit)));
  }

  async function deleteCustomer() {
    if (!deleteId) return;
    setDeleteLoading(true);
    await fetch(`/api/customers/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    setDeleteLoading(false);
    await fetchCustomers(search, null, false);
    toast.show("Customer removed.", "info");
  }

  async function updateCreditLimit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditLoading(true);
    const res = await fetch(`/api/customers/${editingCustomer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditLimit: parseFloat(editCreditLimit) || 0 }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.show(err.error?.message ?? "Failed to update.", "error");
    } else {
      setEditingCustomer(null);
      await fetchCustomers(search, null, false);
      toast.show("Credit limit updated.");
    }
    setEditLoading(false);
  }

  const modalBase = "fixed inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-end md:items-center justify-center animate-fade-in";
  const sheet = "bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg p-6 animate-slide-up-modal";
  const input = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 focus:border-transparent bg-gray-50/50";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Customers</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-press bg-purple-800 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-purple-900 transition-colors shadow-sm"
        >
          + Add
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className={modalBase}>
          <div className={sheet}>
            <h2 className="text-base font-semibold mb-1">Add Customer</h2>
            <p className="text-xs text-gray-400 mb-4">Fill in the shop details below</p>
            <form onSubmit={addCustomer} className="space-y-3">
              <input required placeholder="Shop name" value={newName} onChange={(e) => setNewName(e.target.value)} className={input} />
              <input required placeholder="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className={input} />
              <input placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={input} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Credit Limit (PKR) — 0 = unlimited</label>
                <input type="number" min="0" step="0.01" value={newCreditLimit} onChange={(e) => setNewCreditLimit(e.target.value)} className={input} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600">Cancel</button>
                <button type="submit" disabled={addLoading} className="btn-press flex-1 bg-purple-800 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-purple-900">
                  {addLoading ? "Adding…" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteId && (
        <div className={modalBase}>
          <div className={sheet}>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Remove Customer?</h2>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-800">{customers.find((c) => c.id === deleteId)?.name}</span> will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={deleteCustomer} disabled={deleteLoading} className="btn-press flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-red-700 transition-colors">
                {deleteLoading ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit credit limit modal */}
      {editingCustomer && (
        <div className={modalBase}>
          <div className={sheet}>
            <div className="flex items-center gap-3 mb-4">
              <Avatar name={editingCustomer.name} />
              <div>
                <h2 className="text-base font-semibold">Edit Credit Limit</h2>
                <p className="text-xs text-gray-400">{editingCustomer.name}</p>
              </div>
            </div>
            <form onSubmit={updateCreditLimit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Credit Limit (PKR) — 0 = unlimited</label>
                <input type="number" min="0" step="0.01" value={editCreditLimit} onChange={(e) => setEditCreditLimit(e.target.value)} className={input} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingCustomer(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600">Cancel</button>
                <button type="submit" disabled={editLoading} className="btn-press flex-1 bg-purple-800 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-purple-900">
                  {editLoading ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 focus:border-transparent bg-white"
        />
      </div>

      {loading ? (
        <SkeletonList count={5} variant="customer" />
      ) : customers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">No customers found</p>
          {search && <p className="text-xs text-gray-300 mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c, i) => (
            <div
              key={c.id}
              className="animate-fade-up bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 hover:border-purple-200 hover:shadow-sm transition-all"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <Avatar name={c.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{c.address}</p>
                {c.phone && <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>}
                <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${Number(c.creditLimit) === 0 ? "bg-gray-100 text-gray-500" : "bg-purple-100 text-purple-800"}`}>
                  {Number(c.creditLimit) === 0 ? "Unlimited" : `PKR ${Number(c.creditLimit).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(c)} className="p-2 rounded-xl text-purple-700 hover:bg-purple-50 transition-colors" title="Edit credit limit">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove customer">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => { setLoadingMore(true); fetchCustomers(search, cursor, true).finally(() => setLoadingMore(false)); }}
              disabled={loadingMore}
              className="w-full mt-2 py-2.5 text-sm text-purple-700 font-medium rounded-xl border border-purple-200 hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
