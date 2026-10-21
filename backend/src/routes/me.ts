import { Router } from "express";
import { z } from "zod";
import { col } from "../database/collections";
import { publicUser } from "../repositories/users";
import type { DbProvider, UserDoc } from "../types";
import { ah, parse } from "../utils/http";

export function meRouter(db: DbProvider): Router {
  const r = Router();
  r.get("/me", (req, res) => {
    res.json({ user: publicUser(req.auth!.user) });
  });
  r.patch("/me", ah(async (req, res) => {
    const body = parse(z.object({ displayName: z.string().trim().min(1).max(80) }).strict(), req.body);
    const users = col<UserDoc>(db.getDb(), "ai_users");
    const doc = await users.findOneAndUpdate(
      { uid: req.auth!.uid },
      { $set: { displayName: body.displayName, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    res.json({ user: publicUser(doc!) });
  }));
  return r;
}
