import { Router } from "express";
import { z } from "zod";
import { col } from "../database/collections";
import { requireRole } from "../middleware/auth";
import { RETENTION_DAYS, cleanupState, ttlStatus } from "../services/retention";
import { publicUser } from "../repositories/users";
import type { DbProvider, UserDoc } from "../types";
import { forbidden, notFound } from "../utils/errors";
import { ah, escapeRegex, parse } from "../utils/http";
import { validateUid } from "../utils/ids";

export function adminRouter(deps: { db: DbProvider; revokeSessions: (uid: string) => Promise<void>; log: { warn: (o: object, m: string) => void } }): Router {
  const { db } = deps;
  const r = Router();
  const admins = requireRole("ADMIN", "SUPER_ADMIN");

  // Read-only. The 7-day rule is mandatory and has no write endpoint on purpose.
  r.get("/admin/retention", admins, ah(async (_req, res) => {
    const d = db.getDb();
    const now = new Date();
    const [ttl, expMsgs, expConvs, noExpiry] = await Promise.all([
      ttlStatus(d),
      col(d, "ai_messages").countDocuments({ expiresAt: { $lte: now } }),
      col(d, "ai_conversations").countDocuments({ expiresAt: { $lte: now } }),
      col(d, "ai_messages").countDocuments({ expiresAt: { $exists: false } }),
    ]);
    res.json({
      policy: { days: RETENTION_DAYS, mandatory: true, appliesTo: "all plans", adjustable: false },
      ttlIndexes: ttl,
      expiredButNotYetPurged: { messages: expMsgs, conversations: expConvs },
      messagesMissingExpiry: noExpiry,
      lastCleanup: cleanupState,
    });
  }));

  r.get("/admin/users", admins, ah(async (req, res) => {
    const q = parse(z.object({ search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }), req.query);
    const filter = q.search ? { email: { $regex: "^" + escapeRegex(q.search.toLowerCase()), $options: "i" } } : {};
    const users = col<UserDoc>(db.getDb(), "ai_users");
    const [items, total] = await Promise.all([
      users.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).toArray(),
      users.countDocuments(filter),
    ]);
    res.json({ total, page: q.page, pageSize: q.pageSize, users: items.map(publicUser) });
  }));

  r.patch("/admin/users/:userId/status", admins, ah(async (req, res) => {
    const uid = validateUid(req.params.userId);
    const b = parse(z.object({ status: z.enum(["active", "suspended"]) }).strict(), req.body);
    const actor = req.auth!;
    if (uid === actor.uid) throw forbidden("You cannot change your own status");
    const users = col<UserDoc>(db.getDb(), "ai_users");
    const target = await users.findOne({ uid });
    if (!target) throw notFound("User not found");
    if (actor.role !== "SUPER_ADMIN" && target.role !== "USER" && target.role !== "SUPPORT") throw forbidden("Only a super admin can change this account");
    await users.updateOne({ uid }, { $set: { status: b.status, updatedAt: new Date() } });
    if (b.status === "suspended") {
      try { await deps.revokeSessions(uid); } catch { deps.log.warn({ uid }, "session revoke failed"); }
    }
    await col(db.getDb(), "ai_audit_logs").insertOne({ actorUid: actor.uid, action: "user.status.change", targetUid: uid, details: { status: b.status }, createdAt: new Date() });
    res.json({ uid, status: b.status });
  }));

  return r;
}
