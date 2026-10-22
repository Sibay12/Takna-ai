import type { Db } from "mongodb";
import { col } from "../database/collections";
import type { UsageDoc } from "../types";
import { AppError } from "../utils/errors";

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const quotaError = () => new AppError(429, "quota_exceeded", "Daily AI request limit reached. Try again tomorrow.");

/**
 * Concurrency-safe: the filter only matches while count < limit, so a full counter falls through to an
 * upsert insert that hits the unique (ownerId, day) index (E11000) -> quota error. No read-then-write race.
 */
export async function consumeRequest(db: Db, ownerId: string, limit: number, now = new Date()): Promise<{ used: number }> {
  if (limit <= 0) throw quotaError();
  const day = dayKey(now);
  try {
    const doc = await col<UsageDoc>(db, "ai_ai_usage").findOneAndUpdate(
      { ownerId, day, count: { $lt: limit } },
      { $inc: { count: 1 }, $set: { updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    return { used: doc?.count ?? 1 };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw quotaError();
    throw e;
  }
}

/** Failed provider calls are not charged. */
export async function refundRequest(db: Db, ownerId: string, now = new Date()): Promise<void> {
  await col<UsageDoc>(db, "ai_ai_usage").updateOne({ ownerId, day: dayKey(now), count: { $gt: 0 } }, { $inc: { count: -1 } });
}

export async function getUsedToday(db: Db, ownerId: string, now = new Date()): Promise<number> {
  const doc = await col<UsageDoc>(db, "ai_ai_usage").findOne({ ownerId, day: dayKey(now) });
  return doc?.count ?? 0;
}
