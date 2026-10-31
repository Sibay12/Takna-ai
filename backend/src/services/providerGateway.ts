import { listProviders } from "../repositories/aiProviders";
import type { AiProviderDoc, DbProvider } from "../types";
import { badRequest } from "../utils/errors";
import { AppError } from "../utils/errors";
import { decryptSecret } from "./crypto";
import type { ChatTurn, GenerateOptions } from "./gemini";
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
    return this.adapterFor(doc);
  }

  private async adapterFor(doc: AiProviderDoc): Promise<AiProvider> {
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

  /**
   * Ordered list of connections to try for this request: the requested one (or the default) first,
   * then every other enabled connection, then the env-var fallback last. Lets a reply go through even
   * when one AI connection is down, instead of failing the whole request.
   */
  private async candidates(modelId?: string): Promise<AiProvider[]> {
    const docs = await this.enabledDocs();
    const ordered = modelId && modelId !== "default" ? [...docs.filter((d) => String(d._id) === modelId), ...docs.filter((d) => String(d._id) !== modelId)] : docs;
    const list: AiProvider[] = [];
    for (const doc of ordered) {
      try {
        list.push(await this.adapterFor(doc));
      } catch {
        /* this one connection can't be built (e.g. key storage misconfigured) — skip it, try the rest */
      }
    }
    if (this.fallback.configured) list.push(this.fallback);
    return list;
  }

  /**
   * Sends a chat request, automatically trying every other enabled AI connection (in priority order)
   * if one fails with a provider-side error, so a single down/overloaded connection never stops a reply.
   */
  async sendMessage(turns: ChatTurn[], opts: GenerateOptions, modelId?: string): Promise<{ text: string; provider: AiProvider }> {
    const list = await this.candidates(modelId);
    if (!list.length) throw new AppError(503, "ai_not_configured", "AI is not configured on the server.");
    let lastError: unknown = null;
    for (const provider of list) {
      try {
        const text = await provider.sendMessage(turns, opts);
        return { text, provider };
      } catch (e) {
        lastError = e;
        // Keep trying the next connection — any provider-side failure (timeout, overload, auth, etc.)
        // is exactly the kind of thing the next connection might not have.
      }
    }
    throw lastError instanceof AppError ? lastError : new AppError(502, "ai_provider_error", "The AI service returned an error.");
  }
}
