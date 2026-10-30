"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Wraps dashboard pages: redirects to /login unless signed in AND the backend says this account is an admin. */
export default function Protected({ children }: { children: ReactNode }) {
  const { loading, firebaseUser, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser || isAdmin === false) router.replace("/login");
  }, [loading, firebaseUser, isAdmin, router]);

  if (loading || !firebaseUser || isAdmin !== true) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="muted">Checking your admin access…</p>
      </main>
    );
  }
  return <>{children}</>;
}
