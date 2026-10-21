import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Config } from "../config/env";
import type { TokenVerifier } from "../types";

export function initFirebase(c: Config["firebase"]): void {
  if (getApps().length) return;
  initializeApp({ credential: cert({ projectId: c.projectId, clientEmail: c.clientEmail, privateKey: c.privateKey }) });
}

/** Verifies the Firebase ID token server-side, including revocation. */
export const verifyIdToken: TokenVerifier = async (token) => {
  const d = await getAuth().verifyIdToken(token, true);
  return {
    uid: d.uid,
    email: d.email,
    emailVerified: d.email_verified === true,
    name: d.name as string | undefined,
    picture: d.picture,
    provider: d.firebase?.sign_in_provider,
  };
};

export const revokeSessions = async (uid: string): Promise<void> => {
  await getAuth().revokeRefreshTokens(uid);
};
