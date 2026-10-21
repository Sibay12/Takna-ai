import { Router } from "express";
import { z } from "zod";
import { col } from "../database/collections";
import { LIMITS, createProject, deleteProject, getOwnedProject, upsertFiles } from "../repositories/projects";
import type { DbProvider, ProjectDoc, ProjectFileDoc } from "../types";
import { badRequest } from "../utils/errors";
import { ah, parse } from "../utils/http";
import { parseObjectId } from "../utils/ids";
import { validateRelativePath } from "../utils/paths";

const TYPES = ["static-web", "react-ts", "node", "other"] as const;
const metaSchema = z.record(z.string().max(100), z.string().max(500)).refine((m) => Object.keys(m).length <= 20, "too many keys");

const fileSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string().trim().max(30).default("text"),
});

export function projectsRouter(db: DbProvider): Router {
  const r = Router();

  r.get("/projects", ah(async (req, res) => {
    const items = await col<ProjectDoc>(db.getDb(), "ai_projects")
      .find({ ownerId: req.auth!.uid }).sort({ updatedAt: -1 }).limit(LIMITS.maxProjects).toArray();
    res.json({ projects: items });
  }));

  r.post("/projects", ah(async (req, res) => {
    const b = parse(z.object({ name: z.string().trim().min(1).max(80), type: z.enum(TYPES).default("static-web"), metadata: metaSchema.default({}) }).strict(), req.body);
    res.status(201).json({ project: await createProject(db.getDb(), req.auth!.uid, b.name, b.type, b.metadata) });
  }));

  r.get("/projects/:projectId", ah(async (req, res) => {
    res.json({ project: await getOwnedProject(db.getDb(), req.auth!.uid, parseObjectId(req.params.projectId)) });
  }));

  r.patch("/projects/:projectId", ah(async (req, res) => {
    const id = parseObjectId(req.params.projectId);
    const b = parse(z.object({ name: z.string().trim().min(1).max(80).optional(), metadata: metaSchema.optional() }).strict(), req.body);
    await getOwnedProject(db.getDb(), req.auth!.uid, id);
    await col<ProjectDoc>(db.getDb(), "ai_projects").updateOne({ _id: id, ownerId: req.auth!.uid }, { $set: { ...b, updatedAt: new Date() } });
    res.json({ project: await getOwnedProject(db.getDb(), req.auth!.uid, id) });
  }));

  r.delete("/projects/:projectId", ah(async (req, res) => {
    res.json(await deleteProject(db.getDb(), req.auth!.uid, parseObjectId(req.params.projectId)));
  }));

  r.get("/projects/:projectId/files", ah(async (req, res) => {
    const id = parseObjectId(req.params.projectId);
    await getOwnedProject(db.getDb(), req.auth!.uid, id);
    const files = await col<ProjectFileDoc>(db.getDb(), "ai_project_files")
      .find({ ownerId: req.auth!.uid, projectId: id }).sort({ path: 1 }).toArray();
    res.json({ files });
  }));

  r.put("/projects/:projectId/files", ah(async (req, res) => {
    const id = parseObjectId(req.params.projectId);
    const b = parse(z.object({ files: z.array(fileSchema).min(1).max(LIMITS.maxFilesPerRequest) }).strict(), req.body);
    const seen = new Set<string>();
    const files = b.files.map((f) => {
      const path = validateRelativePath(f.path);
      if (seen.has(path)) throw badRequest("Duplicate file path in request", "duplicate_path");
      seen.add(path);
      if (Buffer.byteLength(f.content, "utf8") > LIMITS.maxFileBytes) throw badRequest("File too large", "file_too_large");
      return { path, content: f.content, language: f.language };
    });
    res.json(await upsertFiles(db.getDb(), req.auth!.uid, id, files));
  }));

  return r;
}
