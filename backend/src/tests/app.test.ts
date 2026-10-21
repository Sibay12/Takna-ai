import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createLogger } from "../config/logger";
import type { DbProvider, TokenVerifier } from "../types";

const log = createLogger("silent");
const now = new Date();
let currentUser: any = { uid: "u1", role: "USER", status: "active", emailVerified: true, email: "a@b.co", createdAt: now, updatedAt: now, lastLoginAt: now };
const fakeDb: any = { collection: () => ({ findOne: async () => currentUser }) };

const readyDb: DbProvider = { isReady: () => true, getDb: () => fakeDb, ping: async () => true };
const downDb: DbProvider = { isReady: () => false, getDb: () => { throw new Error("down"); }, ping: async () => false };
const okVerify: TokenVerifier = async () => ({ uid: "u1", email: "a@b.co", emailVerified: true });
const badVerify: TokenVerifier = async () => { throw new Error("expired"); };

const make = (db: DbProvider, verifyToken: TokenVerifier) =>
  createApp({ corsOrigins: ["https://admin.example.com"], db, verifyToken, revokeSessions: async () => {}, log });

describe("http layer", () => {
  it("GET /health works without the database", async () => {
    const r = await request(make(downDb, okVerify)).get("/health");
    expect(r.status).toBe(200);
  });
  it("GET /ready is 503 while the database is down", async () => {
    expect((await request(make(downDb, okVerify)).get("/ready")).status).toBe(503);
  });
  it("API returns 503 (not a crash) during a database outage", async () => {
    const r = await request(make(downDb, okVerify)).get("/api/v1/me").set("Authorization", "Bearer x");
    expect(r.status).toBe(503);
  });
  it("rejects missing and invalid/expired tokens with 401", async () => {
    expect((await request(make(readyDb, okVerify)).get("/api/v1/me")).status).toBe(401);
    const r = await request(make(readyDb, badVerify)).get("/api/v1/me").set("Authorization", "Bearer bad");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("invalid_token");
  });
  it("returns the verified user and ignores any client-supplied owner/role", async () => {
    const r = await request(make(readyDb, okVerify)).get("/api/v1/me?role=SUPER_ADMIN&ownerId=u2").set("Authorization", "Bearer ok");
    expect(r.status).toBe(200);
    expect(r.body.user.uid).toBe("u1");
    expect(r.body.user.role).toBe("USER");
  });
  it("blocks suspended accounts", async () => {
    currentUser = { ...currentUser, status: "suspended" };
    const r = await request(make(readyDb, okVerify)).get("/api/v1/me").set("Authorization", "Bearer ok");
    expect(r.status).toBe(403);
    currentUser = { ...currentUser, status: "active" };
  });
  it("enforces admin roles server-side", async () => {
    const r = await request(make(readyDb, okVerify)).get("/api/v1/admin/retention").set("Authorization", "Bearer ok");
    expect(r.status).toBe(403);
  });
  it("rejects malformed ids before touching the database", async () => {
    const r = await request(make(readyDb, okVerify)).get("/api/v1/projects/not-an-id").set("Authorization", "Bearer ok");
    expect(r.status).toBe(400);
  });
  it("does not leak error internals", async () => {
    const r = await request(make(readyDb, okVerify)).patch("/api/v1/me").set("Authorization", "Bearer ok").send({ displayName: "" });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toMatch(/stack|node_modules/);
  });
});
