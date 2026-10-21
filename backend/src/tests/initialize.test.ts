import { describe, expect, it, vi } from "vitest";
import { APPROVED_COLLECTIONS } from "../database/collections";
import { initializeDatabase } from "../database/initialize";

function fakeDb(existing: string[]) {
  const created: string[] = [];
  const indexes: Record<string, { key: unknown; options: any }[]> = {};
  const db: any = {
    listCollections: () => ({ toArray: async () => existing.map((name) => ({ name })) }),
    createCollection: vi.fn(async (n: string) => { created.push(n); }),
    collection: (n: string) => ({
      createIndex: vi.fn(async (key: unknown, options: any) => { (indexes[n] ??= []).push({ key, options }); }),
    }),
    // intentionally NO dropDatabase / dropCollection / renameCollection: calling them would throw
  };
  return { db, created, indexes };
}

describe("database initialization", () => {
  it("creates only missing approved collections and never touches foreign ones", async () => {
    const { db, created } = fakeDb(["orders", "ai_users", "ai_legacy_project_x"]);
    const r = await initializeDatabase(db);
    expect(created).not.toContain("ai_users");
    expect(created).not.toContain("orders");
    expect(created).not.toContain("ai_legacy_project_x");
    for (const n of created) expect((APPROVED_COLLECTIONS as readonly string[]).includes(n)).toBe(true);
    expect(r.created).toHaveLength(APPROVED_COLLECTIONS.length - 1);
  });
  it("creates TTL indexes (expireAfterSeconds 0) on messages and conversations", async () => {
    const { db, indexes } = fakeDb([]);
    await initializeDatabase(db);
    for (const n of ["ai_messages", "ai_conversations"]) {
      const ttl = indexes[n].find((i) => i.options.name === "ttl_expiresAt");
      expect(ttl?.options.expireAfterSeconds).toBe(0);
      expect(ttl?.key).toEqual({ expiresAt: 1 });
    }
  });
  it("is idempotent and reports (does not drop) conflicting indexes", async () => {
    const { db } = fakeDb(APPROVED_COLLECTIONS as unknown as string[]);
    db.collection = () => ({ createIndex: async () => { throw new Error("IndexOptionsConflict"); } });
    const r = await initializeDatabase(db);
    expect(r.created).toHaveLength(0);
    expect(r.indexFailures.length).toBeGreaterThan(0);
  });
});
