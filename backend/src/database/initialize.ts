import type { CreateIndexesOptions, Db } from "mongodb";
import type { Logger } from "pino";
import { APPROVED_COLLECTIONS, col, type CollectionName } from "./collections";

export interface IndexSpec {
  key: Record<string, 1 | -1>;
  options: CreateIndexesOptions & { name: string };
}

/** Mandatory 7-day retention: TTL on expiresAt with expireAfterSeconds: 0. */
export const TTL_INDEX: IndexSpec = {
  key: { expiresAt: 1 },
  options: { name: "ttl_expiresAt", expireAfterSeconds: 0 },
};

export const INDEXES: Partial<Record<CollectionName, IndexSpec[]>> = {
  ai_users: [
    { key: { uid: 1 }, options: { name: "uniq_uid", unique: true } },
    { key: { email: 1 }, options: { name: "idx_email" } },
    { key: { role: 1 }, options: { name: "idx_role" } },
  ],
  ai_projects: [{ key: { ownerId: 1, updatedAt: -1 }, options: { name: "idx_owner_updated" } }],
  ai_project_files: [
    { key: { projectId: 1, path: 1 }, options: { name: "uniq_project_path", unique: true } },
    { key: { ownerId: 1 }, options: { name: "idx_owner" } },
  ],
  ai_conversations: [
    { key: { ownerId: 1, updatedAt: -1 }, options: { name: "idx_owner_updated" } },
    TTL_INDEX,
  ],
  ai_messages: [
    { key: { conversationId: 1, createdAt: 1 }, options: { name: "idx_conv_created" } },
    { key: { ownerId: 1 }, options: { name: "idx_owner" } },
    TTL_INDEX,
  ],
  ai_subscription_plans: [{ key: { planId: 1 }, options: { name: "uniq_plan", unique: true } }],
  ai_subscriptions: [{ key: { ownerId: 1, status: 1 }, options: { name: "idx_owner_status" } }],
  ai_payment_transactions: [
    {
      key: { provider: 1, reference: 1 },
      options: { name: "uniq_provider_ref", unique: true, partialFilterExpression: { reference: { $type: "string" } } },
    },
    { key: { ownerId: 1, createdAt: -1 }, options: { name: "idx_owner_created" } },
  ],
  ai_ai_providers: [{ key: { enabled: 1, isDefault: -1 }, options: { name: "idx_enabled_default" } }],
  ai_ai_usage: [{ key: { ownerId: 1, day: 1 }, options: { name: "uniq_owner_day", unique: true } }],
  ai_entitlement_usage: [{ key: { ownerId: 1, period: 1 }, options: { name: "uniq_owner_period", unique: true } }],
  ai_application_settings: [{ key: { key: 1 }, options: { name: "uniq_key", unique: true } }],
  ai_audit_logs: [{ key: { createdAt: -1 }, options: { name: "idx_created" } }],
};

export interface InitReport {
  created: string[];
  indexFailures: { collection: string; index: string; reason: string }[];
}

/**
 * Idempotent and non-destructive: creates only MISSING approved collections and approved indexes.
 * Never drops, renames or modifies anything else. Unknown collections are never touched.
 */
export async function initializeDatabase(db: Db, log?: Logger): Promise<InitReport> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const report: InitReport = { created: [], indexFailures: [] };

  for (const name of APPROVED_COLLECTIONS) {
    if (existing.has(name)) continue;
    try {
      await db.createCollection(name);
      report.created.push(name);
    } catch (e) {
      if ((e as { code?: number }).code !== 48) throw e; // 48 = already exists (race)
    }
  }

  for (const name of APPROVED_COLLECTIONS) {
    for (const spec of INDEXES[name] ?? []) {
      try {
        await col(db, name).createIndex(spec.key, spec.options);
      } catch (e) {
        // Conflicting existing index: report, do NOT drop or alter it automatically.
        const reason = e instanceof Error ? e.message : "unknown";
        report.indexFailures.push({ collection: name, index: spec.options.name, reason });
        log?.error({ collection: name, index: spec.options.name }, "index init failed; existing index left untouched");
      }
    }
  }
  log?.info({ created: report.created, indexFailures: report.indexFailures.length }, "database initialized");
  return report;
}
