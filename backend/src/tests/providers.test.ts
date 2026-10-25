import { ObjectId } from "mongodb";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createLogger } from "../config/logger";
import { encryptSecret } from "../services/crypto";
import type { AiProvider } from "../services/gemini";
import { GeminiProvider } from "../services/gemini";
import { ProviderGateway } from "../services/providerGateway";
import { AnthropicProvider, OpenAiProvider } from "../services/providers";
import type { AiProviderDoc, DbProvider, TokenVerifier } from "../types";

const secret = "k".repeat(40);
const mk = (over: Partial<AiProviderDoc>): AiProviderDoc => ({
  _id: new ObjectId(), type: "gemini", displayName: "TAKNA Swift", model: "gemini-flash-latest",
  apiKeyEnc: encryptSecret("real-api-key-1234", secret), keyHint: "••••1234", enabled: true, isDefault: false,
  createdBy: "a", createdAt: new Date(), updatedAt: new Date(), ...over,
});

/** Tiny in-memory stand-in for the collections these routes touch. */
function fakeDb(store: AiProviderDoc[], user: object) {
  const providers = {
    find: () => ({ sort: () => ({ toArray: async () => [...store] }) }),
    findOne: async (f: { _id: ObjectId }) => store.find((d) => String(d._id) === String(f._id)) ?? null,
    insertOne: async (d: AiProviderDoc) => { store.push(d); },
    updateMany: async (_f: object, u: { $set: Partial<AiProviderDoc> }) => { store.forEach((d) => Object.assign(d, u.$set)); },
    updateOne: async (f: { _id: ObjectId }, u: { $set: Partial<AiProviderDoc> }) => { const d = store.find((x) => String(x._id) === String(f._id)); if (d) Object.assign(d, u.$set); },
    deleteOne: async (f: { _id: ObjectId }) => { const i = store.findIndex((x) => String(x._id) === String(f._id)); if (i >= 0) store.splice(i, 1); },
  };
  const db: any = {
    collection: (name: string) =>
      name === "ai_ai_providers" ? providers : name === "ai_users" ? { findOne: async () => user } : { insertOne: async () => ({}) },
  };
  const provider: DbProvider = { isReady: () => true, getDb: () => db, ping: async () => true };
  return provider;
}

const fallbackOn: AiProvider = { model: "env-model", configured: true, sendMessage: async () => "x", listModels: async () => [] };
const fallbackOff: AiProvider = { ...fallbackOn, configured: false };

describe("provider gateway", () => {
  it("shows customers only display names (no model, type or key)", async () => {
    const store = [mk({ displayName: "TAKNA Swift", isDefault: true }), mk({ type: "anthropic", displayName: "TAKNA Deep", model: "claude-x" })];
    const g = new ProviderGateway(fakeDb(store, {}), secret, fallbackOff);
    const models = await g.publicModels();
    expect(models.map((m) => m.displayName)).toEqual(["TAKNA Swift", "TAKNA Deep"]);
    const json = JSON.stringify(models);
    expect(json).not.toMatch(/gemini|claude|anthropic|apiKey|real-api-key/i);
  });
  it("uses the default connection and the right adapter per type", async () => {
    const a = mk({ isDefault: false, type: "anthropic", model: "m1" });
    const o = mk({ isDefault: false, type: "openai", model: "m2" });
    const d = mk({ isDefault: true, type: "gemini", model: "m3" });
    const g = new ProviderGateway(fakeDb([a, o, d], {}), secret, fallbackOff);
    expect(await g.resolve()).toBeInstanceOf(GeminiProvider);
    expect(await g.resolve(String(a._id))).toBeInstanceOf(AnthropicProvider);
    expect(await g.resolve(String(o._id))).toBeInstanceOf(OpenAiProvider);
  });
  it("rejects an unknown model id and skips disabled connections", async () => {
    const off = mk({ enabled: false });
    const on = mk({ isDefault: true });
    const g = new ProviderGateway(fakeDb([off, on], {}), secret, fallbackOff);
    await expect(g.resolve(String(off._id))).rejects.toMatchObject({ code: "unknown_model" });
    await expect(g.resolve("nope")).rejects.toMatchObject({ code: "unknown_model" });
  });
  it("falls back to the environment provider, or reports not configured", async () => {
    const empty = fakeDb([], {});
    expect(await new ProviderGateway(empty, secret, fallbackOn).resolve()).toBe(fallbackOn);
    expect(await new ProviderGateway(empty, secret, fallbackOn).publicModels()).toEqual([{ id: "default", displayName: "TAKNA AI" }]);
    await expect(new ProviderGateway(empty, secret, fallbackOff).resolve()).rejects.toMatchObject({ status: 503, code: "ai_not_configured" });
    // no encryption secret -> stored connections are ignored
    expect(await new ProviderGateway(fakeDb([mk({})], {}), undefined, fallbackOn).resolve()).toBe(fallbackOn);
  });
});

describe("provider adapters", () => {
  it("Anthropic: sends the key as a header, merges roles, returns text", async () => {
    let seen: any;
    const f = (async (url: string, init: any) => { seen = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ content: [{ type: "text", text: "hi" }] })); }) as unknown as typeof fetch;
    const p = new AnthropicProvider("sk-ant-abcdefgh", "m", f);
    expect(await p.sendMessage([{ role: "user", content: "a" }, { role: "user", content: "b" }], { system: "S", maxOutputTokens: 50 })).toBe("hi");
    expect(seen.url).toBe("https://api.anthropic.com/v1/messages");
    expect(seen.init.headers["x-api-key"]).toBe("sk-ant-abcdefgh");
    expect(seen.body.system).toBe("S");
    expect(seen.body.messages).toEqual([{ role: "user", content: "a\n\nb" }]);
    expect(JSON.stringify(seen.body)).not.toContain("sk-ant");
  });
  it("OpenAI: bearer auth, system message first", async () => {
    let seen: any;
    const f = (async (_u: string, init: any) => { seen = { init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ choices: [{ message: { content: "yo" } }] })); }) as unknown as typeof fetch;
    const p = new OpenAiProvider("sk-openai-12345678", "m", f);
    expect(await p.sendMessage([{ role: "user", content: "a" }], { system: "S" })).toBe("yo");
    expect(seen.init.headers.authorization).toBe("Bearer sk-openai-12345678");
    expect(seen.body.messages[0]).toEqual({ role: "system", content: "S" });
  });
  it("maps provider errors to generic, vendor-free messages", async () => {
    const f = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await expect(new AnthropicProvider("k-12345678", "m", f).sendMessage([{ role: "user", content: "a" }])).rejects.toMatchObject({ code: "ai_provider_auth" });
  });
});

describe("admin provider routes", () => {
  const log = createLogger("silent");
  const ok: TokenVerifier = async () => ({ uid: "u1", email: "a@b.co", emailVerified: true });
  const now = new Date();
  const user = (role: string) => ({ uid: "u1", role, status: "active", emailVerified: true, email: "a@b.co", createdAt: now, updatedAt: now, lastLoginAt: now });
  const app = (store: AiProviderDoc[], role: string, withSecret = true) =>
    createApp({ corsOrigins: [], db: fakeDb(store, user(role)), verifyToken: ok, revokeSessions: async () => {}, log, ai: fallbackOff, keyEncryptionSecret: withSecret ? secret : undefined, aiLimits: { dailyRequests: 30, maxOutputTokens: 256 } });
  const auth = { Authorization: "Bearer t" };
  const body = { type: "anthropic", displayName: "TAKNA Deep", model: "claude-sonnet-4", apiKey: "sk-ant-SECRETVALUE1234" };

  it("only a SUPER_ADMIN can manage connections", async () => {
    for (const role of ["USER", "ADMIN"]) {
      expect((await request(app([], role)).get("/api/v1/admin/ai/providers").set(auth)).status).toBe(403);
      expect((await request(app([], role)).post("/api/v1/admin/ai/providers").set(auth).send(body)).status).toBe(403);
    }
  });
  it("stores the key encrypted and never returns it", async () => {
    const store: AiProviderDoc[] = [];
    const a = app(store, "SUPER_ADMIN");
    const created = await request(a).post("/api/v1/admin/ai/providers").set(auth).send(body);
    expect(created.status).toBe(201);
    expect(created.body.provider.isDefault).toBe(true); // first one becomes default
    expect(JSON.stringify(created.body)).not.toContain("SECRETVALUE");
    expect(created.body.provider.keyHint).toBe("••••1234");
    expect(store[0].apiKeyEnc).not.toContain("SECRETVALUE");
    const list = await request(a).get("/api/v1/admin/ai/providers").set(auth);
    expect(JSON.stringify(list.body)).not.toMatch(/SECRETVALUE|apiKeyEnc/);
  });
  it("can change the key, rename and delete at any time", async () => {
    const store: AiProviderDoc[] = [];
    const a = app(store, "SUPER_ADMIN");
    const id = (await request(a).post("/api/v1/admin/ai/providers").set(auth).send(body)).body.provider.id;
    const before = store[0].apiKeyEnc;
    const p = await request(a).patch(`/api/v1/admin/ai/providers/${id}`).set(auth).send({ apiKey: "sk-ant-NEWKEYVALUE9999", displayName: "TAKNA Pro" });
    expect(p.status).toBe(200);
    expect(p.body.provider.displayName).toBe("TAKNA Pro");
    expect(p.body.provider.keyHint).toBe("••••9999");
    expect(store[0].apiKeyEnc).not.toBe(before);
    expect((await request(a).delete(`/api/v1/admin/ai/providers/${id}`).set(auth)).status).toBe(200);
    expect(store).toHaveLength(0);
  });
  it("refuses to save keys when KEY_ENCRYPTION_SECRET is not set, and validates input", async () => {
    const r = await request(app([], "SUPER_ADMIN", false)).post("/api/v1/admin/ai/providers").set(auth).send(body);
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("key_storage_not_configured");
    const bad = await request(app([], "SUPER_ADMIN")).post("/api/v1/admin/ai/providers").set(auth).send({ ...body, type: "other" });
    expect(bad.status).toBe(400);
  });
  it("customers list models by display name only", async () => {
    const store = [mk({ displayName: "TAKNA Swift", isDefault: true, model: "gemini-flash-latest" })];
    const r = await request(app(store, "USER")).get("/api/v1/ai/models").set(auth);
    expect(r.status).toBe(200);
    expect(r.body.models).toEqual([{ id: String(store[0]._id), displayName: "TAKNA Swift" }]);
  });
});
