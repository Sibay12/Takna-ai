import { listProviders } from "../repositories/aiProviders";
import type { AiProviderDoc, DbProvider } from "../types";
import { badRequest } from "../utils/errors";
import { AppError } from "../utils/errors";
import { decryptSecret } from "./crypto";
import { GeminiProvider, type AiProvider } from "./gemini";
import { AnthropicProvider, OpenAiProvider } from "./providers";

export interface PublicModel {
  id: string;
  displayName: string;
}

export function buildProvider(doc: Pick<AiProviderDoc, "type" | "model">, apiKey: string, fetchFn: typeof fetch = fetch): AiProvider {
  if (doc.type === "anthropic") return new AnthropicProvider(apiKey, doc.model, fetchFn);
  if (doc.type === "openai") return new OpenAiProvider(apiKey, doc.model, fetchFn);
  return new GeminiProvider(apiKey, doc.model, fetchFn);
}

/**
 * Chooses which AI connection answers a request. Connections come from the admin panel (keys encrypted in MongoDB).
 * If none are configured there, the GEMINI_API_KEY environment provider is the fallback, so nothing breaks.
 * Customers only ever see `displayName`.
 */
export class ProviderGateway {
  private cache: { docs: AiProviderDoc[]; at: number } | null = null;
  private adapters = new Map<string, { stamp: number; provider: AiProvider }>();

  constructor(
    private readonly db: DbProvider,
    private readonly secret: string | undefined,
    private readonly fallback: AiProvider,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly ttlMs = 30_000,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  private async enabledDocs(): Promise<AiProviderDoc[]> {
    if (!this.secret || !this.db.isReady()) return [];
    if (!this.cache || Date.now() - this.cache.at > this.ttlMs) {
      try {
        const all = await listProviders(this.db.getDb());
        this.cache = { docs: all, at: Date.now() };
      } catch {
        return this.cache?.docs.filter((d) => d.enabled) ?? [];
      }
    }
    return this.cache.docs.filter((d) => d.enabled).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async publicModels(): Promise<PublicModel[]> {
    const docs = await this.enabledDocs();
    if (docs.length) return docs.map((d) => ({ id: String(d._id), displayName: d.displayName }));
    return this.fallback.configured ? [{ id: "default", displayName: "TAKNA AI" }] : [];
  }

  /** Returns the connection to use. A specific `modelId` must be one of the enabled public models. */
  async resolve(modelId?: string): Promise<AiProvider> {
    const docs = await this.enabledDocs();
    if (!docs.length || modelId === "default") {
      if (this.fallback.configured) return this.fallback;
      throw new AppError(503, "ai_not_configured", "AI is not configured on the server.");
    }
    const doc = modelId ? docs.find((d) => String(d._id) === modelId) : docs[0];
    if (!doc) throw badRequest("Unknown model", "unknown_model");
    const key = String(doc._id);
    const stamp = doc.updatedAt.getTime();
    const hit = this.adapters.get(key);
    if (hit && hit.stamp === stamp) return hit.provider;
    let apiKey: string;
    try {
      apiKey = decryptSecret(doc.apiKeyEnc, this.secret as string);
    } catch {
      throw new AppError(503, "ai_not_configured", "The AI service is temporarily unavailable.");
    }
    const provider = buildProvider(doc, apiKey, this.fetchFn);
    this.adapters.set(key, { stamp, provider });
    return provider;
  }
}
