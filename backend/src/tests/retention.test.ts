import { describe, expect, it, vi } from "vitest";
import { RETENTION_MS, cleanupExpired, computeExpiresAt, ttlStatus, unexpired } from "../services/retention";

const DAY = 24 * 60 * 60 * 1000;

describe("7 day retention", () => {
  it("expiresAt is exactly createdAt + 7 days", () => {
    const t = new Date("2026-10-21T10:00:00Z");
    expect(RETENTION_MS).toBe(7 * DAY);
    expect(computeExpiresAt(t).getTime() - t.getTime()).toBe(7 * DAY);
  });
  it("each message gets its own expiry (no reset)", () => {
    const a = new Date("2026-10-21T10:00:00Z");
    const b = new Date("2026-10-23T10:00:00Z");
    expect(computeExpiresAt(a).getTime()).not.toBe(computeExpiresAt(b).getTime());
    expect(computeExpiresAt(a).toISOString()).toBe("2026-10-28T10:00:00.000Z");
  });
  it("API filter excludes expired docs", () => {
    const now = new Date();
    expect(unexpired(now)).toEqual({ expiresAt: { $gt: now } });
  });
  it("cleanup only touches the two retention collections and filters on expiresAt", async () => {
    const touched: Record<string, unknown> = {};
    const db: any = {
      collection: (name: string) => ({
        deleteMany: vi.fn(async (f: unknown) => { touched[name] = f; return { deletedCount: 2 }; }),
      }),
    };
    const now = new Date();
    const r = await cleanupExpired(db, now);
    expect(Object.keys(touched).sort()).toEqual(["ai_conversations", "ai_messages"]);
    for (const f of Object.values(touched)) expect(f).toEqual({ expiresAt: { $lte: now } });
    expect(r.deletedMessages).toBe(2);
  });
  it("ttlStatus flags a missing or wrong TTL index", async () => {
    const db: any = {
      collection: (name: string) => ({
        indexes: async () => name === "ai_messages"
          ? [{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }]
          : [{ key: { expiresAt: 1 }, expireAfterSeconds: 99 }],
      }),
    };
    const s = await ttlStatus(db);
    expect(s.find((x) => x.collection === "ai_messages")?.ok).toBe(true);
    expect(s.find((x) => x.collection === "ai_conversations")?.ok).toBe(false);
  });
});
