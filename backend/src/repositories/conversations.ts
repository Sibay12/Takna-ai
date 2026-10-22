import { ObjectId, type Db } from "mongodb";
import { col } from "../database/collections";
import { computeExpiresAt, unexpired } from "../services/retention";
import type { ConversationDoc, MessageDoc } from "../types";
import { gone, notFound, AppError } from "../utils/errors";

export async function createConversation(db: Db, ownerId: string, title: string, now = new Date()): Promise<ConversationDoc> {
  const doc: ConversationDoc = {
    _id: new ObjectId(),
    ownerId,
    title,
    createdAt: now,
    updatedAt: now,
    expiresAt: computeExpiresAt(now),
  };
  await col<ConversationDoc>(db, "ai_conversations").insertOne(doc);
  return doc;
}

export async function listConversations(db: Db, ownerId: string, limit: number, before?: Date, now = new Date()) {
  const filter: Record<string, unknown> = { ownerId, ...unexpired(now) };
  if (before) filter.updatedAt = { $lt: before };
  return col<ConversationDoc>(db, "ai_conversations").find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();
}

/** Ownership + expiry check. Expired history is rejected even if TTL has not purged it yet. */
export async function getOwnedConversation(db: Db, ownerId: string, id: ObjectId, now = new Date()): Promise<ConversationDoc> {
  const conv = await col<ConversationDoc>(db, "ai_conversations").findOne({ _id: id, ownerId });
  if (!conv) throw notFound("Conversation not found");
  if (conv.expiresAt.getTime() <= now.getTime()) throw gone("Conversation history has expired");
  return conv;
}

export async function listMessages(db: Db, ownerId: string, id: ObjectId, limit: number, now = new Date()) {
  await getOwnedConversation(db, ownerId, id, now);
  return col<MessageDoc>(db, "ai_messages")
    .find({ ownerId, conversationId: id, ...unexpired(now) })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
}

/**
 * Each message gets its OWN expiry (createdAt + 7d); existing messages are never extended.
 * The conversation's expiresAt follows its newest message so it never expires before its messages.
 */
export async function appendMessage(
  db: Db,
  ownerId: string,
  conversationId: ObjectId,
  role: MessageDoc["role"],
  content: string,
  now = new Date(),
): Promise<MessageDoc> {
  await getOwnedConversation(db, ownerId, conversationId, now);
  const expiresAt = computeExpiresAt(now);
  const msg: MessageDoc = { _id: new ObjectId(), ownerId, conversationId, role, content, createdAt: now, expiresAt };
  await col<MessageDoc>(db, "ai_messages").insertOne(msg);
  await col<ConversationDoc>(db, "ai_conversations").updateOne(
    { _id: conversationId, ownerId },
    { $set: { updatedAt: now, expiresAt } },
  );
  return msg;
}

/** Delete Chat Now: success is reported only after the database confirms nothing remains. */
export async function deleteConversationNow(db: Db, ownerId: string, id: ObjectId) {
  const convs = col<ConversationDoc>(db, "ai_conversations");
  const msgs = col<MessageDoc>(db, "ai_messages");
  const conv = await convs.findOne({ _id: id, ownerId });
  if (!conv) throw notFound("Conversation not found");
  const m = await msgs.deleteMany({ ownerId, conversationId: id });
  const c = await convs.deleteOne({ _id: id, ownerId });
  const remaining = await msgs.countDocuments({ ownerId, conversationId: id });
  const convLeft = await convs.countDocuments({ _id: id, ownerId });
  if (remaining > 0 || convLeft > 0 || c.deletedCount !== 1) {
    throw new AppError(500, "deletion_unconfirmed", "Deletion could not be confirmed. Please retry.");
  }
  return { deletedMessages: m.deletedCount, deletedConversation: true, confirmed: true };
}

/** Newest-first window re-sorted oldest-first, expired messages excluded. */
export async function recentMessages(db: Db, ownerId: string, id: ObjectId, n: number, now = new Date()) {
  await getOwnedConversation(db, ownerId, id, now);
  const rows = await col<MessageDoc>(db, "ai_messages")
    .find({ ownerId, conversationId: id, ...unexpired(now) })
    .sort({ createdAt: -1 })
    .limit(n)
    .toArray();
  return rows.reverse();
}
