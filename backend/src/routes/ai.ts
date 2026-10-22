import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { appendMessage, createConversation, recentMessages } from "../repositories/conversations";
import { consumeRequest, getUsedToday, refundRequest } from "../repositories/usage";
import { chatSystem, codeSystem, codeUserPrompt } from "../services/aiTasks";
import type { AiProvider, ChatTurn } from "../services/gemini";
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
  .object({ conversationId: z.string().optional(), message: z.string().trim().min(1).max(8000), language: lang, mode: z.enum(["text", "voice"]).default("text") })
  .strict();

const codeSchema = z
  .object({
    task: z.enum(["generate", "analyze", "debug", "website", "summarize"]),
    prompt: z.string().trim().min(1).max(12000),
    language: lang,
    files: z.array(z.object({ path: z.string(), content: z.string().max(100_000) })).max(10).default([]),
  })
  .strict();

const HISTORY_TURNS = 20;

export function aiRouter(deps: { db: DbProvider; ai: AiProvider; limits: AiLimits }): Router {
  const { db, ai, limits } = deps;
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

  r.get("/ai/status", (_req, res) => {
    res.json({ configured: ai.configured, model: ai.model, dailyRequests: limits.dailyRequests, maxOutputTokens: limits.maxOutputTokens, streaming: false });
  });

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

    const { result: reply, used } = await guarded(owner, () =>
      ai.sendMessage(turns, { system: chatSystem(b.language, b.mode), maxOutputTokens: b.mode === "voice" ? Math.min(limits.maxOutputTokens, 400) : limits.maxOutputTokens }),
    );

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
    const { result: text, used } = await guarded(req.auth!.uid, () =>
      ai.sendMessage([{ role: "user", content: codeUserPrompt(b.prompt, files) }], {
        system: codeSystem(b.task, b.language),
        maxOutputTokens: limits.maxOutputTokens,
      }),
    );
    res.json({ task: b.task, text, usage: { used, limit: limits.dailyRequests } });
  }));

  return r;
}
