import { timingSafeEqual } from "node:crypto";
import { MongoClient } from "mongodb";
import { loadConfig } from "../config/env";
import { col } from "../database/collections";
import type { UserDoc } from "../types";

/**
 * One-time super admin provisioning (run by the operator, never exposed over HTTP).
 * Usage: npm run admin:bootstrap -- you@example.com --secret=<ADMIN_BOOTSTRAP_SECRET>
 * Refuses if a SUPER_ADMIN already exists, or the user has not signed in with a verified email.
 */
async function main() {
  const c = loadConfig();
  const email = process.argv[2]?.toLowerCase();
  const given = process.argv.find((a) => a.startsWith("--secret="))?.slice(9) ?? "";
  if (!email || !c.adminBootstrapSecret) throw new Error("Provide an email and set ADMIN_BOOTSTRAP_SECRET");
  const a = Buffer.from(given);
  const b = Buffer.from(c.adminBootstrapSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Bootstrap secret mismatch");

  const client = new MongoClient(c.mongoUri, { serverSelectionTimeoutMS: 8000, appName: "takna-ai-bootstrap" });
  await client.connect();
  try {
    const db = client.db(c.dbName);
    const users = col<UserDoc>(db, "ai_users");
    if (await users.findOne({ role: "SUPER_ADMIN" })) throw new Error("A super admin already exists. Refusing.");
    const user = await users.findOne({ email });
    if (!user) throw new Error("User not found. Sign in once from the app first.");
    if (!user.emailVerified) throw new Error("User's email is not verified.");
    await users.updateOne({ uid: user.uid }, { $set: { role: "SUPER_ADMIN", updatedAt: new Date() } });
    await col(db, "ai_audit_logs").insertOne({ actorUid: "system:bootstrap", action: "admin.bootstrap", targetUid: user.uid, createdAt: new Date() });
    console.log("Super admin provisioned.");
  } finally {
    await client.close();
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "failed"); process.exit(1); });
