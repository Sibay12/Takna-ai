"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function OverviewPage() {
  const { me } = useAuth();
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Overview</h1>
      <p className="muted">Signed in as {me?.email} ({me?.role}).</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
        <Link href="/dashboard/users" style={{ textDecoration: "none" }}>
          <div className="card">
            <h3 style={{ margin: "0 0 6px" }}>Users</h3>
            <p className="muted" style={{ margin: 0 }}>Search accounts, suspend or reactivate.</p>
          </div>
        </Link>
        <Link href="/dashboard/providers" style={{ textDecoration: "none" }}>
          <div className="card">
            <h3 style={{ margin: "0 0 6px" }}>AI providers</h3>
            <p className="muted" style={{ margin: 0 }}>Manage AI connections, keys and the names customers see.</p>
          </div>
        </Link>
        <Link href="/dashboard/retention" style={{ textDecoration: "none" }}>
          <div className="card">
            <h3 style={{ margin: "0 0 6px" }}>Retention</h3>
            <p className="muted" style={{ margin: 0 }}>7-day chat retention status (read-only, mandatory).</p>
          </div>
        </Link>
      </div>
      {me?.role !== "SUPER_ADMIN" && (
        <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
          Some actions (changing AI provider keys, and changing another admin&apos;s status) need a super admin account.
        </p>
      )}
    </div>
  );
}
