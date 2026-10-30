"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { configured, loading, firebaseUser, isAdmin, error, signIn, resetPassword, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (firebaseUser && isAdmin) router.replace("/dashboard");
  }, [firebaseUser, isAdmin, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await signIn(email, password); } catch { /* error already set */ } finally { setBusy(false); }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResetMessage(null);
    try {
      await resetPassword(email);
      setResetMessage("If that email has an account, a reset link was just sent. Check your inbox and spam folder.");
    } catch {
      setResetMessage("Could not send the reset email right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: 360 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Image src="/takna-logo.png" alt="TAKNA AI" width={96} height={96} style={{ borderRadius: 16 }} />
        </div>
        <h1 style={{ textAlign: "center", fontSize: 20, margin: "0 0 4px" }}>TAKNA AI Admin</h1>
        <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>TAKNA TECHNOLOGY · SIBAYAN ENTERPRISE</p>

        {!configured ? (
          <p className="error-text">
            Firebase is not configured on this deployment (NEXT_PUBLIC_FIREBASE_* environment variables are missing).
          </p>
        ) : loading ? (
          <p className="muted">Loading…</p>
        ) : firebaseUser && isAdmin === false ? (
          <>
            <p className="error-text">This account ({firebaseUser.email}) is not an admin on TAKNA AI.</p>
            <button className="btn secondary" style={{ width: "100%" }} onClick={() => signOut()}>Sign out</button>
          </>
        ) : mode === "reset" ? (
          <form onSubmit={submitReset}>
            <p className="muted" style={{ marginTop: 0 }}>
              Not sure which email your admin account uses? Open Firebase console → Authentication → Users to look it up.
            </p>
            <label className="muted">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ margin: "6px 0 12px" }} />
            {resetMessage && <p className="muted" style={{ fontSize: 13 }}>{resetMessage}</p>}
            <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => { setMode("signin"); setResetMessage(null); }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={submit}>
            <label className="muted">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ margin: "6px 0 12px" }} />
            <label className="muted">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ margin: "6px 0 12px" }} />
            {error && <p className="error-text">{error}</p>}
            <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => { setMode("reset"); setResetMessage(null); }}
            >
              Forgot password?
            </button>
            <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
              Admin accounts are managed on TAKNA AI itself, not created here.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
