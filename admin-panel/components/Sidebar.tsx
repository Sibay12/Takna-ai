"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/providers", label: "AI providers" },
  { href: "/dashboard/retention", label: "Retention" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { me, signOut } = useAuth();
  const router = useRouter();

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <Image src="/takna-logo.png" alt="" width={32} height={32} style={{ borderRadius: 8 }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>TAKNA AI</div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                textDecoration: "none",
                background: active ? "var(--navy-light)" : "transparent",
                color: active ? "var(--cyan)" : "var(--text)",
                fontSize: 14,
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8, wordBreak: "break-all" }}>
          {me?.email} · {me?.role}
        </div>
        <button
          className="btn secondary"
          style={{ width: "100%" }}
          onClick={async () => { await signOut(); router.replace("/login"); }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
