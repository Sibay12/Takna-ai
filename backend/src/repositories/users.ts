import type { Db } from "mongodb";
import { col } from "../database/collections";
import type { AccountStatus, Role, UserDoc, VerifiedToken } from "../types";

const FRESH_MS = 10 * 60 * 1000;

/** Role and status come ONLY from the database. Never from the client or token claims. */
export async function resolveUser(db: Db, t: VerifiedToken, now: Date = new Date()): Promise<UserDoc> {
  const users = col<UserDoc>(db, "ai_users");
  const email = t.email?.toLowerCase();
  const existing = await users.findOne({ uid: t.uid });
  if (
    existing &&
    existing.emailVerified === t.emailVerified &&
    existing.email === email &&
    now.getTime() - existing.lastLoginAt.getTime() < FRESH_MS
  ) {
    return existing;
  }
  const set: Partial<UserDoc> = { emailVerified: t.emailVerified, lastLoginAt: now, updatedAt: now };
  if (email) set.email = email;
  const onInsert: Partial<UserDoc> = {
    uid: t.uid,
    role: "USER" as Role,
    status: "active" as AccountStatus,
    createdAt: now,
  };
  if (t.name) onInsert.displayName = t.name;
  if (t.picture) onInsert.photoUrl = t.picture;
  if (t.provider) onInsert.provider = t.provider;
  const doc = await users.findOneAndUpdate(
    { uid: t.uid },
    { $set: set, $setOnInsert: onInsert },
    { upsert: true, returnDocument: "after" },
  );
  if (!doc) throw new Error("user upsert failed");
  return doc;
}

export const publicUser = (u: UserDoc) => ({
  uid: u.uid,
  email: u.email ?? null,
  displayName: u.displayName ?? null,
  photoUrl: u.photoUrl ?? null,
  emailVerified: u.emailVerified,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt,
});

/**
 * Render Free has no shell, so the first super admin is provisioned via INITIAL_SUPER_ADMIN_EMAIL.
 * Promotes only: a VERIFIED email that matches exactly, while NO super admin exists yet. Audited.
 */
export async function maybePromoteInitialSuperAdmin(db: Db, user: UserDoc, initialEmail?: string): Promise<UserDoc> {
  if (!initialEmail || user.role === "SUPER_ADMIN" || !user.emailVerified || user.email !== initialEmail.toLowerCase()) return user;
  const users = col<UserDoc>(db, "ai_users");
  if (await users.findOne({ role: "SUPER_ADMIN" })) return user;
  const updated = await users.findOneAndUpdate(
    { uid: user.uid, role: { $ne: "SUPER_ADMIN" } },
    { $set: { role: "SUPER_ADMIN", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (updated) {
    await col(db, "ai_audit_logs").insertOne({ actorUid: "system:initial-super-admin", action: "admin.bootstrap", targetUid: user.uid, createdAt: new Date() });
  }
  return updated ?? user;
}
