import type { Logger } from "pino";
import type { DbProvider } from "../types";
import { cleanupExpired, cleanupState } from "../services/retention";

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw last;
}

export function startRetentionJob(db: DbProvider, log: Logger, intervalMs = 15 * 60 * 1000): () => void {
  const run = async () => {
    if (!db.isReady()) return;
    try {
      const r = await withRetry(() => cleanupExpired(db.getDb()));
      log.info({ deletedMessages: r.deletedMessages, deletedConversations: r.deletedConversations }, "retention cleanup");
    } catch (e) {
      cleanupState.lastError = e instanceof Error ? e.name : "error";
      log.error({ reason: cleanupState.lastError }, "retention cleanup failed; will retry next interval");
    }
  };
  const t = setInterval(run, intervalMs);
  t.unref();
  return () => clearInterval(t);
}
