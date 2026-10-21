import { ObjectId, type Db } from "mongodb";
import { col } from "../database/collections";
import type { ProjectDoc, ProjectFileDoc } from "../types";
import { badRequest, notFound } from "../utils/errors";

// Interim hard caps. Phase 10 replaces these with entitlement-driven quotas.
export const LIMITS = { maxProjects: 50, maxFileBytes: 512 * 1024, maxFilesPerRequest: 100 };

export async function getOwnedProject(db: Db, ownerId: string, id: ObjectId): Promise<ProjectDoc> {
  const p = await col<ProjectDoc>(db, "ai_projects").findOne({ _id: id, ownerId });
  if (!p) throw notFound("Project not found"); // 404 for foreign ids too (no IDOR leak)
  return p;
}

export async function createProject(db: Db, ownerId: string, name: string, type: string, metadata: Record<string, string>) {
  const projects = col<ProjectDoc>(db, "ai_projects");
  if ((await projects.countDocuments({ ownerId })) >= LIMITS.maxProjects) {
    throw badRequest("Project limit reached", "project_limit");
  }
  const now = new Date();
  const doc: ProjectDoc = { _id: new ObjectId(), ownerId, name, type, metadata, createdAt: now, updatedAt: now };
  await projects.insertOne(doc);
  return doc;
}

export async function deleteProject(db: Db, ownerId: string, id: ObjectId) {
  await getOwnedProject(db, ownerId, id);
  const f = await col<ProjectFileDoc>(db, "ai_project_files").deleteMany({ ownerId, projectId: id });
  await col<ProjectDoc>(db, "ai_projects").deleteOne({ _id: id, ownerId });
  return { deletedFiles: f.deletedCount };
}

export async function upsertFiles(
  db: Db,
  ownerId: string,
  projectId: ObjectId,
  files: { path: string; content: string; language: string }[],
) {
  await getOwnedProject(db, ownerId, projectId);
  const now = new Date();
  const ops = files.map((f) => ({
    updateOne: {
      filter: { projectId, path: f.path, ownerId },
      update: {
        $set: { content: f.content, language: f.language, updatedAt: now },
        $inc: { version: 1 },
        $setOnInsert: { createdAt: now },
      },
      upsert: true,
    },
  }));
  if (ops.length) await col<ProjectFileDoc>(db, "ai_project_files").bulkWrite(ops);
  await col<ProjectDoc>(db, "ai_projects").updateOne({ _id: projectId, ownerId }, { $set: { updatedAt: now } });
  return { saved: files.length };
}
