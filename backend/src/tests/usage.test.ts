import { describe, expect, it, vi } from "vitest";
import { consumeRequest, dayKey, getUsedToday, refundRequest } from "../repositories/usage";

describe("daily quota", () => {
  it("increments atomically and reports usage", async () => {
    const fn = vi.fn(async () => ({ count: 3 }));
    const db: any = { collection: () => ({ findOneAndUpdate: fn }) };
    const r = await consumeRequest(db, "u1", 30, new Date("2026-10-21T10:00:00Z"));
    expect(r.used).toBe(3);
    const [filter, update] = fn.mock.calls[0] as any[];
    expect(filter).toEqual({ ownerId: "u1", day: "2026-10-21", count: { $lt: 30 } });
    expect(update.$inc).toEqual({ count: 1 });
  });
  it("turns a duplicate-key error (counter full) into 429 quota_exceeded", async () => {
    const db: any = { collection: () => ({ findOneAndUpdate: async () => { throw Object.assign(new Error("dup"), { code: 11000 }); } }) };
    const err: any = await consumeRequest(db, "u1", 5).catch((e) => e);
    expect(err.status).toBe(429);
    expect(err.code).toBe("quota_exceeded");
  });
  it("a zero limit never touches the database", async () => {
    const db: any = { collection: () => { throw new Error("no"); } };
    expect(((await consumeRequest(db, "u1", 0).catch((e) => e)) as any).status).toBe(429);
  });
  it("rethrows unrelated database errors", async () => {
    const db: any = { collection: () => ({ findOneAndUpdate: async () => { throw new Error("boom"); } }) };
    expect(((await consumeRequest(db, "u1", 5).catch((e) => e)) as Error).message).toBe("boom");
  });
  it("refund decrements only when count > 0; usage defaults to 0", async () => {
    const up = vi.fn(async () => ({}));
    const db: any = { collection: () => ({ updateOne: up, findOne: async () => null }) };
    await refundRequest(db, "u1", new Date("2026-10-21T00:00:00Z"));
    expect((up.mock.calls[0] as any[])[0]).toEqual({ ownerId: "u1", day: "2026-10-21", count: { $gt: 0 } });
    expect(await getUsedToday(db, "u1")).toBe(0);
    expect(dayKey(new Date("2026-10-21T23:59:59Z"))).toBe("2026-10-21");
  });
});
