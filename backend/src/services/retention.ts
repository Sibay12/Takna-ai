import type { Db } from "mongodb";
import { col } from "../database/collections";

export const RETENTION_DAYS = 7;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** expiresAt = createdAt + 7 days. Computed per message; never reset by later messages. */
export const computeExpiresAt = (createdAt: Date): Date => new Date(createdAt.getTime() + RETENTION_MS);

/** API-level enforcement filter (TTL deletion is asynchronous). */
export const unexpired = (now: Date = new Date()) => ({ expiresAt: { $gt: now } });

export const RETENTION_COLLECTIONS = ["ai_messages", "ai_conversations"] as const;

export interface CleanupResult {
  at: Date;
  deletedMessages: number;
  deletedConversations: number;
}

export const cleanupState: { lastRunAt: Date | null; lastResult: CleanupResult | null; lastError: string | null } = {
  lastRunAt: null,
  lastResult: null,
  lastError: null,
};

export async function ttlStatus(db: Db) {
  const out = [];
  for (const name of RETENTION_COLLECTIONS) {
    const indexes = await col(db, name).indexes();
    const ttl = indexes.find((i) => (i.key as Record<string, unknown>).expiresAt === 1);
    out.push({
      collection: name,
      present: !!ttl,
      expireAfterSeconds: ttl?.expireAfterSeconds ?? null,
      ok: !!ttl && ttl.expireAfterSeconds === 0,
    });
  }
  return out;
}

/** Safety-net purge scoped to the two retention collections and to expired documents only. */
export async function cleanupExpired(db: Db, now: Date = new Date()): Promise<CleanupResult> {
  const filter = { expiresAt: { $lte: now } };
  const m = await col(db, "ai_messages").deleteMany(filter);
  const c = await col(db, "ai_conversations").deleteMany(filter);
  const result: CleanupResult = { at: now, deletedMessages: m.deletedCount, deletedConversations: c.deletedCount };
  cleanupState.lastRunAt = new Date();
  cleanupState.lastResult = result;
  cleanupState.lastError = null;
  return result;
}
