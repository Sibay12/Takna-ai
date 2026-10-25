import { describe, expect, it } from "vitest";
import { APPROVED_COLLECTIONS, assertApprovedCollection, col, isApprovedCollection } from "../database/collections";

describe("collection allowlist", () => {
  it("has the 16 approved collections, all prefixed ai_", () => {
    expect(APPROVED_COLLECTIONS).toHaveLength(17);
    for (const n of APPROVED_COLLECTIONS) expect(n.startsWith("ai_")).toBe(true);
  });
  it("accepts every approved name", () => {
    for (const n of APPROVED_COLLECTIONS) expect(() => assertApprovedCollection(n)).not.toThrow();
  });
  it("rejects names without prefix, with the prefix but unapproved, or oddly cased", () => {
    for (const n of ["users", "orders", "ai_other_project", "AI_users", "ai_users ", "ai_", "", "system.users"]) {
      expect(isApprovedCollection(n)).toBe(false);
      expect(() => assertApprovedCollection(n)).toThrow();
    }
  });
  it("col() refuses unapproved names before touching the db", () => {
    const db: any = { collection: () => { throw new Error("should not be called"); } };
    expect(() => col(db, "payments" as any)).toThrow(/allowlist/);
  });
});
