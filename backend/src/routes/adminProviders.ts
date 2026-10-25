import { ObjectId } from "mongodb";
import { Router } from "express";
import { z } from "zod";
import { col } from "../database/collections";
import { requireRole } from "../middleware/auth";
import { deleteProvider, getProvider, insertProvider, listProviders, updateProvider } from "../repositories/aiProviders";
import { encryptSecret, maskKey } from "../services/crypto";
import { buildProvider, type ProviderGateway } from "../services/providerGateway";
import type { AiProviderDoc, DbProvider } from "../types";
import { notFound, unavailable } from "../utils/errors";
import { ah, parse } from "../utils/http";
import { parseObjectId } from "../utils/ids";
import { decryptSecret } from "../services/crypto";

const type = z.enum(["gemini", "anthropic", "openai"]);
const displayName = z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} ._+\-]+$/u, "letters, digits, spaces and . _ + - only");
const model = z.string().trim().regex(/^[A-Za-z0-9._:\-/]{1,80}$/, "invalid model id");
const apiKey = z.string().trim().min(8).max(600).regex(/^[\x21-\x7e]+$/, "invalid characters");

const createSchema = z.object({ type, displayName, model, apiKey, enabled: z.boolean().default(true), isDefault: z.boolean().default(false) }).strict();
const patchSchema = z.object({ displayName: displayName.optional(), model: model.optional(), apiKey: apiKey.optional(), enabled: z.boolean().optional(), isDefault: z.boolean().optional() }).strict();

/** Admin view: never includes the key, only a masked hint. */
const view = (d: AiProviderDoc) => ({
  id: String(d._id),
  type: d.type,
  displayName: d.displayName,
  model: d.model,
  keyHint: d.keyHint,
  enabled: d.enabled,
  isDefault: d.isDefault,
  updatedAt: d.updatedAt,
});

/** SUPER_ADMIN only: these are paid third-party credentials. */
export function adminProvidersRouter(deps: { db: DbProvider; secret: string | undefined; gateway: ProviderGateway }): Router {
  const { db, secret, gateway } = deps;
  const r = Router();
  const superOnly = requireRole("SUPER_ADMIN");
  const needSecret = () => {
    if (!secret) throw unavailable("Key storage is not configured on the server (KEY_ENCRYPTION_SECRET).", "key_storage_not_configured");
    return secret;
  };
  const audit = (actor: string, action: string, id: string, details: object = {}) =>
    col(db.getDb(), "ai_audit_logs").insertOne({ actorUid: actor, action, targetId: id, details, createdAt: new Date() });

  r.get("/admin/ai/providers", superOnly, ah(async (_req, res) => {
    res.json({ keyStorageConfigured: !!secret, providers: (await listProviders(db.getDb())).map(view) });
  }));

  r.post("/admin/ai/providers", superOnly, ah(async (req, res) => {
    const s = needSecret();
    const b = parse(createSchema, req.body);
    const now = new Date();
    const existing = await listProviders(db.getDb());
    const doc: AiProviderDoc = {
      _id: new ObjectId(),
      type: b.type,
      displayName: b.displayName,
      model: b.model,
      apiKeyEnc: encryptSecret(b.apiKey, s),
      keyHint: maskKey(b.apiKey),
      enabled: b.enabled,
      isDefault: b.isDefault || existing.length === 0,
      createdBy: req.auth!.uid,
      createdAt: now,
      updatedAt: now,
    };
    await insertProvider(db.getDb(), doc);
    gateway.invalidate();
    await audit(req.auth!.uid, "ai.provider.create", String(doc._id), { type: doc.type, displayName: doc.displayName });
    res.status(201).json({ provider: view(doc) });
  }));

  r.patch("/admin/ai/providers/:id", superOnly, ah(async (req, res) => {
    const id = parseObjectId(req.params.id);
    const b = parse(patchSchema, req.body);
    const cur = await getProvider(db.getDb(), id);
    if (!cur) throw notFound("Provider not found");
    const set: Partial<AiProviderDoc> = {};
    if (b.displayName !== undefined) set.displayName = b.displayName;
    if (b.model !== undefined) set.model = b.model;
    if (b.enabled !== undefined) set.enabled = b.enabled;
    if (b.isDefault !== undefined) set.isDefault = b.isDefault;
    if (b.apiKey !== undefined) {
      set.apiKeyEnc = encryptSecret(b.apiKey, needSecret());
      set.keyHint = maskKey(b.apiKey);
    }
    await updateProvider(db.getDb(), id, set);
    gateway.invalidate();
    await audit(req.auth!.uid, "ai.provider.update", String(id), { fields: Object.keys(b), keyChanged: b.apiKey !== undefined });
    res.json({ provider: view((await getProvider(db.getDb(), id)) as AiProviderDoc) });
  }));

  r.delete("/admin/ai/providers/:id", superOnly, ah(async (req, res) => {
    const id = parseObjectId(req.params.id);
    const cur = await getProvider(db.getDb(), id);
    if (!cur) throw notFound("Provider not found");
    await deleteProvider(db.getDb(), id);
    gateway.invalidate();
    await audit(req.auth!.uid, "ai.provider.delete", String(id), { displayName: cur.displayName });
    res.json({ id: String(id), deleted: true });
  }));

  // Live check with the stored key: does it connect, and which models can it use?
  r.post("/admin/ai/providers/:id/test", superOnly, ah(async (req, res) => {
    const s = needSecret();
    const cur = await getProvider(db.getDb(), parseObjectId(req.params.id));
    if (!cur) throw notFound("Provider not found");
    const p = buildProvider(cur, decryptSecret(cur.apiKeyEnc, s));
    let connection: { ok: boolean; error?: string } = { ok: true };
    try {
      await p.sendMessage([{ role: "user", content: "Reply with: OK" }], { maxOutputTokens: 16 });
    } catch (e) {
      connection = { ok: false, error: (e as { code?: string }).code ?? "error" };
    }
    let models: string[] | null = null;
    try { models = await p.listModels(); } catch { models = null; }
    res.json({ connection, availableModels: models });
  }));

  return r;
}
