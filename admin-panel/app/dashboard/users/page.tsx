"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type AdminUser } from "@/lib/api";

export default function UsersPage() {
  const { idToken, me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = async (p = page, s = search) => {
    setError(null);
    const token = await idToken();
    if (!token) return;
    try {
      const r = await api.users(token, p, s);
      setUsers(r.users);
      setTotal(r.total);
      setPage(r.page);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load users.");
    }
  };

  useEffect(() => { load(1, ""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStatus = async (u: AdminUser) => {
    const next = u.status === "active" ? "suspended" : "active";
    if (!confirm(`${next === "suspended" ? "Suspend" : "Reactivate"} ${u.email ?? u.uid}?`)) return;
    const token = await idToken();
    if (!token) return;
    setBusyUid(u.uid);
    try {
      await api.setUserStatus(token, u.uid, next);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Could not change this user's status.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Users</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); load(1, search); }}
        style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 420 }}
      >
        <input type="text" placeholder="Search by email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn secondary" type="submit">Search</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {!users ? (
        <p className="muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="muted">No users found.</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Email</th><th>Role</th><th>Status</th><th>Verified</th><th>Joined</th><th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.displayName ? `${u.displayName} · ` : ""}{u.email ?? u.uid}</td>
                  <td>{u.role}</td>
                  <td><span className={`badge ${u.status === "active" ? "ok" : "bad"}`}>{u.status}</span></td>
                  <td>{u.emailVerified ? "Yes" : "No"}</td>
                  <td className="muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    {u.uid !== me?.uid && (
                      <button
                        className={`btn ${u.status === "active" ? "danger" : "secondary"}`}
                        disabled={busyUid === u.uid}
                        onClick={() => toggleStatus(u)}
                      >
                        {u.status === "active" ? "Suspend" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <span className="muted">{total} total</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn secondary" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
              <button className="btn secondary" disabled={page * 25 >= total} onClick={() => load(page + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
