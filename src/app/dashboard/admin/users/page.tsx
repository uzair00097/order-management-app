"use client";
import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/Spinner";

type Role = "DISTRIBUTOR" | "SALESMAN";
type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  distributorId: string | null;
  distributor: { id: string; name: string } | null;
  createdAt: string;
};

const ROLE_FILTERS: (Role | "ALL")[] = ["ALL", "DISTRIBUTOR", "SALESMAN"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [distributors, setDistributors] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [loading, setLoading] = useState(true);

  // Add user form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALESMAN" as Role, distributorId: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Assign distributor
  const [assigningUser, setAssigningUser] = useState<User | null>(null);
  const [assignDistId, setAssignDistId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchUsers = useCallback(async (role: Role | "ALL") => {
    const params = new URLSearchParams();
    if (role !== "ALL") params.set("role", role);
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.data ?? []);
  }, []);

  const fetchDistributors = useCallback(async () => {
    const res = await fetch("/api/admin/users?role=DISTRIBUTOR");
    const data = await res.json();
    setDistributors(data.data ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(roleFilter), fetchDistributors()]).finally(() => setLoading(false));
  }, [roleFilter, fetchUsers, fetchDistributors]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");

    const body: Record<string, string> = { name: form.name, email: form.email, password: form.password, role: form.role };
    if (form.role === "SALESMAN" && form.distributorId) body.distributorId = form.distributorId;

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      setAddError(err.error?.message ?? "Failed to create user.");
    } else {
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "SALESMAN", distributorId: "" });
      await fetchUsers(roleFilter);
    }
    setAddLoading(false);
  }

  async function assignDistributor() {
    if (!assigningUser) return;
    setAssignLoading(true);
    await fetch(`/api/admin/users/${assigningUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distributorId: assignDistId || null }),
    });
    setAssigningUser(null);
    setAssignLoading(false);
    await fetchUsers(roleFilter);
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await fetchUsers(roleFilter);
  }

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      ADMIN: "bg-purple-100 text-purple-900",
      DISTRIBUTOR: "bg-purple-100 text-purple-800",
      SALESMAN: "bg-purple-100 text-purple-900",
    };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[role] ?? ""}`}>{role}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">User Management</h1>
        <button onClick={() => setShowAdd(true)}
          className="bg-purple-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-900 transition-colors">
          + Add User
        </button>
      </div>

      {/* Add user modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold mb-4">Add User</h2>
            {addError && <p className="text-sm text-red-600 mb-3">{addError}</p>}
            <form onSubmit={addUser} className="space-y-3">
              <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700" />
              <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700" />
              <input required type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700">
                <option value="SALESMAN">Salesman</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
              {form.role === "SALESMAN" && (
                <select required value={form.distributorId} onChange={(e) => setForm({ ...form, distributorId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700">
                  <option value="">Select distributor…</option>
                  {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
                <button type="submit" disabled={addLoading}
                  className="flex-1 bg-purple-800 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                  {addLoading ? "Creating…" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign modal */}
      {assigningUser && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold mb-1">Reassign Distributor</h2>
            <p className="text-sm text-gray-500 mb-4">{assigningUser.name}</p>
            <select value={assignDistId} onChange={(e) => setAssignDistId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-purple-700">
              <option value="">Unassign (no distributor)</option>
              {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setAssigningUser(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={assignDistributor} disabled={assignLoading}
                className="flex-1 bg-purple-800 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
                {assignLoading ? "Saving…" : "Save Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role filter */}
      <div className="flex gap-2 mb-4">
        {ROLE_FILTERS.map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              roleFilter === r ? "bg-purple-800 text-white border-purple-800" : "bg-white text-gray-600 border-gray-200"
            }`}>
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No users found</div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    {roleBadge(user.role)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                  {user.role === "SALESMAN" && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {user.distributor ? `→ ${user.distributor.name}` : "⚠ No distributor assigned"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {user.role === "SALESMAN" && (
                    <button onClick={() => { setAssigningUser(user); setAssignDistId(user.distributorId ?? ""); }}
                      className="text-xs text-purple-800 hover:underline font-medium">Reassign</button>
                  )}
                  <button onClick={() => deleteUser(user.id)}
                    className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
