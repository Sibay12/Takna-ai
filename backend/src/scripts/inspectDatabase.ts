import { MongoClient } from "mongodb";
import { loadConfig } from "../config/env";
import { APPROVED_COLLECTIONS } from "../database/collections";

/** Read-only: lists collection NAMES only. Does not read, modify or count other projects' data. */
async function main() {
  const c = loadConfig();
  const client = new MongoClient(c.mongoUri, { serverSelectionTimeoutMS: 8000, appName: "takna-ai-inspect" });
  await client.connect();
  try {
    const names = (await client.db(c.dbName).listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name);
    const approvedPresent = APPROVED_COLLECTIONS.filter((n) => names.includes(n));
    const approvedMissing = APPROVED_COLLECTIONS.filter((n) => !names.includes(n));
    const others = names.filter((n) => !(APPROVED_COLLECTIONS as readonly string[]).includes(n));
    console.log(JSON.stringify({ database: c.dbName, approvedPresent, wouldCreateOnStartup: approvedMissing, otherCollectionsNeverTouched: others }, null, 2));
  } finally {
    await client.close();
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "failed"); process.exit(1); });
