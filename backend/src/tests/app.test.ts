import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createLogger } from "../config/logger";
import type { AiProvider } from "../services/gemini";
import { AppError } from "../utils/errors";
import type { DbProvider, TokenVerifier } from "../types";

const log = createLogger("silent");
const now = new Date();
let currentUser: any = { uid: "u1", role: "USER", status: "active", emailVerified: true, email: "a@b.co", createdAt: now, updatedAt: now, lastLoginAt: now };
const fakeDb: any = { collection: () => ({ findOne: async () => currentUser }) };

const readyDb: DbProvider = { isReady: () => true, getDb: () => fakeDb, ping: async () => true };
const downDb: DbProvider = { isReady: () => false, getDb: () => { throw new Error("down"); }, ping: async () => false };
const okVerify: TokenVerifier = async () => ({ uid: "u1", email: "a@b.co", emailVerified: true });
const badVerify: TokenVerifier = async () => { throw new Error("expired"); };

const okAi: AiProvider = { model: "m", configured: true, sendMessage: async () => "hello", listModels: async () => ["m"] };
const failAi: AiProvider = { ...okAi, sendMessage: async () => { throw new AppError(502, "ai_provider_error", "x"); } };

const make = (db: DbProvider, verifyToken: TokenVerifier, ai: AiProvider = okAi) =>
  createApp({ corsOrigins: ["https://admin.example.com"], db, verifyToken, revokeSessions: async () => {}, log, ai, aiLimits: { dailyRequests: 30, maxOutputTokens: 256 } });

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

  it("AI routes require authentication", async () => {
    expect((await request(make(readyDb, okVerify)).post("/api/v1/ai/chat").send({ message: "hi" })).status).toBe(401);
    expect((await request(make(readyDb, okVerify)).post("/api/v1/ai/code").send({})).status).toBe(401);
  });
  it("validates AI payloads", async () => {
    const app = make(readyDb, okVerify);
    expect((await request(app).post("/api/v1/ai/chat").set("Authorization", "Bearer ok").send({})).status).toBe(400);
    expect((await request(app).post("/api/v1/ai/chat").set("Authorization", "Bearer ok").send({ message: "x".repeat(8001) })).status).toBe(400);
    const bad = await request(app).post("/api/v1/ai/code").set("Authorization", "Bearer ok").send({ task: "debug", prompt: "p", files: [{ path: "../etc/passwd", content: "x" }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("invalid_path");
  });
  it("reports usage and status", async () => {
    const u = await request(make(readyDb, okVerify)).get("/api/v1/usage").set("Authorization", "Bearer ok");
    expect(u.status).toBe(200);
    expect(u.body.limit).toBe(30);
    const st = await request(make(readyDb, okVerify)).get("/api/v1/ai/status").set("Authorization", "Bearer ok");
    expect(st.body.configured).toBe(true);
    expect(JSON.stringify(st.body)).not.toMatch(/key/i);
  });
  it("refunds the quota when the AI provider fails", async () => {
    const calls: any[] = [];
    const db: any = {
      collection: (n: string) => ({
        findOne: async () => currentUser,
        findOneAndUpdate: async () => ({ count: 1 }),
        updateOne: async (_f: unknown, u: unknown) => { calls.push([n, u]); return {}; },
      }),
    };
    const dbp: DbProvider = { isReady: () => true, getDb: () => db, ping: async () => true };
    const r = await request(make(dbp, okVerify, failAi)).post("/api/v1/ai/chat").set("Authorization", "Bearer ok").send({ message: "hello" });
    expect(r.status).toBe(502);
    expect(calls.some(([n, u]) => n === "ai_ai_usage" && JSON.stringify(u) === JSON.stringify({ $inc: { count: -1 } }))).toBe(true);
  });
});
