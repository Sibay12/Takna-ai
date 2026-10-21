import { Router } from "express";
import { z } from "zod";
import { createConversation, deleteConversationNow, listConversations, listMessages } from "../repositories/conversations";
import type { DbProvider } from "../types";
import { badRequest } from "../utils/errors";
import { ah, parse } from "../utils/http";
import { parseObjectId } from "../utils/ids";

export function conversationsRouter(db: DbProvider): Router {
  const r = Router();

  r.get("/conversations", ah(async (req, res) => {
    const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), before: z.string().optional() }), req.query);
    let before: Date | undefined;
    if (q.before) {
      before = new Date(q.before);
      if (Number.isNaN(before.getTime())) throw badRequest("before: invalid date", "validation_error");
    }
    res.json({ conversations: await listConversations(db.getDb(), req.auth!.uid, q.limit, before) });
  }));

  r.post("/conversations", ah(async (req, res) => {
    const b = parse(z.object({ title: z.string().trim().max(100).default("New chat") }).strict(), req.body ?? {});
    res.status(201).json({ conversation: await createConversation(db.getDb(), req.auth!.uid, b.title) });
  }));

  r.get("/conversations/:conversationId/messages", ah(async (req, res) => {
    const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(200) }), req.query);
    const messages = await listMessages(db.getDb(), req.auth!.uid, parseObjectId(req.params.conversationId), q.limit);
    res.json({ messages });
  }));

  r.delete("/conversations/:conversationId", ah(async (req, res) => {
    res.json(await deleteConversationNow(db.getDb(), req.auth!.uid, parseObjectId(req.params.conversationId)));
  }));

  return r;
}
