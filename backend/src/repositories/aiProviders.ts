import type { Db, ObjectId } from "mongodb";
import { col } from "../database/collections";
import type { AiProviderDoc } from "../types";

export const listProviders = (db: Db) => col<AiProviderDoc>(db, "ai_ai_providers").find({}).sort({ createdAt: 1 }).toArray();

export const getProvider = (db: Db, id: ObjectId) => col<AiProviderDoc>(db, "ai_ai_providers").findOne({ _id: id });

export async function insertProvider(db: Db, doc: AiProviderDoc): Promise<void> {
  const c = col<AiProviderDoc>(db, "ai_ai_providers");
  if (doc.isDefault) await c.updateMany({}, { $set: { isDefault: false } });
  await c.insertOne(doc);
}

export async function updateProvider(db: Db, id: ObjectId, set: Partial<Omit<AiProviderDoc, "_id">>): Promise<void> {
  const c = col<AiProviderDoc>(db, "ai_ai_providers");
  if (set.isDefault === true) await c.updateMany({}, { $set: { isDefault: false } });
  await c.updateOne({ _id: id }, { $set: { ...set, updatedAt: new Date() } });
}

export const deleteProvider = (db: Db, id: ObjectId) => col<AiProviderDoc>(db, "ai_ai_providers").deleteOne({ _id: id });
