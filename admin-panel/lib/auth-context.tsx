"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase";
import { api, type MeUser } from "./api";

interface AuthState {
  configured: boolean;
  loading: boolean;
  firebaseUser: User | null;
  me: MeUser | null;
  /** null while unknown, false once we know this signed-in account is not ADMIN/SUPER_ADMIN. */
  isAdmin: boolean | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  idToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [me, setMe] = useState<MeUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      setMe(null);
      setIsAdmin(null);
      if (u) {
        try {
          const token = await u.getIdToken();
          const r = await api.me(token);
          setMe(r.user);
          setIsAdmin(r.user.role === "ADMIN" || r.user.role === "SUPER_ADMIN");
        } catch (e) {
          setIsAdmin(false);
        }
      }
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase is not configured on this deployment.");
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      const msg =
        e?.code === "auth/invalid-credential" || e?.code === "auth/wrong-password" || e?.code === "auth/user-not-found"
          ? "Wrong email or password."
          : e?.code === "auth/too-many-requests"
            ? "Too many attempts. Please wait and try again."
            : "Could not sign in. Please try again.";
      setError(msg);
      throw e;
    }
  };

  const signOutFn = async () => { if (auth) await fbSignOut(auth); };

  const idToken = async () => (firebaseUser ? firebaseUser.getIdToken() : null);

  return (
    <Ctx.Provider value={{ configured: firebaseConfigured, loading, firebaseUser, me, isAdmin, error, signIn, signOut: signOutFn, idToken }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
