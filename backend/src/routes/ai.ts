import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { appendMessage, createConversation, recentMessages } from "../repositories/conversations";
import { consumeRequest, getUsedToday, refundRequest } from "../repositories/usage";
import { chatSystem, codeSystem, codeUserPrompt } from "../services/aiTasks";
import type { AiProvider, ChatTurn } from "../services/gemini";
import type { ProviderGateway } from "../services/providerGateway";
import { sanitizeReply } from "../services/sanitize";
import type { DbProvider } from "../types";
import { badRequest } from "../utils/errors";
import { ah, parse } from "../utils/http";
import { parseObjectId } from "../utils/ids";
import { validateRelativePath } from "../utils/paths";

export interface AiLimits {
  dailyRequests: number;
  maxOutputTokens: number;
}

const lang = z.enum(["auto", "hi", "en", "hinglish"]).default("auto");

const chatSchema = z
  .object({ conversationId: z.string().optional(), message: z.string().trim().min(1).max(8000), language: lang, mode: z.enum(["text", "voice"]).default("text"), modelId: z.string().max(40).optional() })
  .strict();

const codeSchema = z
  .object({
    task: z.enum(["generate", "analyze", "debug", "website", "summarize"]),
    prompt: z.string().trim().min(1).max(12000),
    language: lang,
    modelId: z.string().max(40).optional(),
    files: z.array(z.object({ path: z.string(), content: z.string().max(100_000) })).max(10).default([]),
  })
  .strict();

const HISTORY_TURNS = 20;

export function aiRouter(deps: { db: DbProvider; ai: AiProvider; limits: AiLimits; gateway?: ProviderGateway }): Router {
  const { db, ai, limits, gateway } = deps;
  const pick = async (modelId?: string): Promise<AiProvider> => (gateway ? gateway.resolve(modelId) : ai);
  const r = Router();
  const perUser = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.uid ?? "anon",
    validate: false,
  });

  /** Charge one request, call the provider, and refund if the provider fails. */
  async function guarded<T>(owner: string, fn: () => Promise<T>): Promise<{ result: T; used: number }> {
    const d = db.getDb();
    const { used } = await consumeRequest(d, owner, limits.dailyRequests);
    try {
      return { result: await fn(), used };
    } catch (e) {
      await refundRequest(d, owner).catch(() => undefined);
      throw e;
    }
  }

  r.get("/ai/status", ah(async (_req, res) => {
    const configured = gateway ? (await gateway.publicModels()).length > 0 : ai.configured;
    res.json({ configured, dailyRequests: limits.dailyRequests, maxOutputTokens: limits.maxOutputTokens, streaming: false });
  }));

  // Customers only ever get the display names chosen in the admin panel.
  r.get("/ai/models", ah(async (_req, res) => {
    res.json({ models: gateway ? await gateway.publicModels() : ai.configured ? [{ id: "default", displayName: "TAKNA AI" }] : [] });
  }));

  r.get("/usage", ah(async (req, res) => {
    const used = await getUsedToday(db.getDb(), req.auth!.uid);
    res.json({ period: "day", used, limit: limits.dailyRequests, remaining: Math.max(0, limits.dailyRequests - used) });
  }));

  r.post("/ai/chat", perUser, ah(async (req, res) => {
    const b = parse(chatSchema, req.body);
    const owner = req.auth!.uid;
    const d = db.getDb();
    const convId = b.conversationId ? parseObjectId(b.conversationId) : undefined;
    const history: ChatTurn[] = convId
      ? (await recentMessages(d, owner, convId, HISTORY_TURNS)).flatMap((m) =>
          m.role === "user" || m.role === "assistant" ? [{ role: m.role, content: m.content } as ChatTurn] : [],
        )
      : [];
    const turns: ChatTurn[] = [...history, { role: "user", content: b.message }];
    const provider = await pick(b.modelId);

    const { result: raw, used } = await guarded(owner, () =>
      provider.sendMessage(turns, { system: chatSystem(b.language, b.mode), maxOutputTokens: b.mode === "voice" ? Math.min(limits.maxOutputTokens, 400) : limits.maxOutputTokens }),
    );

    const reply = sanitizeReply(raw, [provider.model]);
    const id = convId ?? (await createConversation(d, owner, b.message.slice(0, 50).trim() || "New chat"))._id;
    await appendMessage(d, owner, id, "user", b.message);
    const saved = await appendMessage(d, owner, id, "assistant", reply);
    res.json({
      conversationId: id,
      reply: { role: "assistant", content: reply, createdAt: saved.createdAt, expiresAt: saved.expiresAt },
      usage: { used, limit: limits.dailyRequests },
    });
  }));

  // Not persisted: coding assistance results are returned to the caller only.
  r.post("/ai/code", perUser, ah(async (req, res) => {
    const b = parse(codeSchema, req.body);
    let total = 0;
    const files = b.files.map((f) => {
      total += Buffer.byteLength(f.content, "utf8");
      return { path: validateRelativePath(f.path), content: f.content };
    });
    if (total > 200_000) throw badRequest("Attached files are too large", "payload_too_large");
    const provider = await pick(b.modelId);
    const { result: rawText, used } = await guarded(req.auth!.uid, () =>
      provider.sendMessage([{ role: "user", content: codeUserPrompt(b.prompt, files) }], {
        system: codeSystem(b.task, b.language),
        maxOutputTokens: limits.maxOutputTokens,
      }),
    );
    const text = sanitizeReply(rawText, [provider.model]);
    res.json({ task: b.task, text, usage: { used, limit: limits.dailyRequests } });
  }));

  return r;
}
