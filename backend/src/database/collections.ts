import type { Collection, Db, Document } from "mongodb";

/** Explicit allowlist of collections owned by TAKNA AI. A prefix alone is NOT authorization. */
export const APPROVED_COLLECTIONS = [
  "ai_users",
  "ai_user_profiles",
  "ai_projects",
  "ai_project_files",
  "ai_conversations",
  "ai_messages",
  "ai_ai_usage",
  "ai_ai_providers",
  "ai_subscriptions",
  "ai_subscription_plans",
  "ai_payment_transactions",
  "ai_subscription_events",
  "ai_entitlement_usage",
  "ai_application_settings",
  "ai_support_tickets",
  "ai_audit_logs",
  "ai_admin_invites",
] as const;

export type CollectionName = (typeof APPROVED_COLLECTIONS)[number];

const APPROVED = new Set<string>(APPROVED_COLLECTIONS);

export function isApprovedCollection(name: string): name is CollectionName {
  return typeof name === "string" && name.startsWith("ai_") && APPROVED.has(name);
}

export function assertApprovedCollection(name: string): asserts name is CollectionName {
  if (!isApprovedCollection(name)) {
    throw new Error(`Collection is not on the TAKNA AI allowlist: ${JSON.stringify(name)}`);
  }
}

/** The ONLY way application code obtains a collection handle. */
export function col<T extends Document = Document>(db: Db, name: CollectionName): Collection<T> {
  assertApprovedCollection(name);
  return db.collection<T>(name);
}
