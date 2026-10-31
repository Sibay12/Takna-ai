import { AppError } from "../utils/errors";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
export interface GenerateOptions {
  system?: string;
  maxOutputTokens?: number;
}
export interface AiProvider {
  readonly model: string;
  readonly configured: boolean;
  sendMessage(turns: ChatTurn[], opts?: GenerateOptions): Promise<string>;
  listModels(): Promise<string[]>;
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export function mapStatus(status: number): AppError {
  if (status === 429) return new AppError(429, "ai_rate_limited", "AI is busy right now. Please try again shortly.");
  if (status === 401 || status === 403) return new AppError(502, "ai_provider_auth", "The AI service is temporarily unavailable.");
  if (status === 404) return new AppError(502, "ai_model_unsupported", "The AI service is temporarily unavailable.");
  if (status === 400) return new AppError(502, "ai_bad_request", "The AI service could not process this request.");
  return new AppError(502, "ai_provider_error", "The AI service returned an error.");
}

/** Gemini via the official REST API (generateContent). The key is sent as a header, never logged or returned. */
export class GeminiProvider implements AiProvider {
  readonly configured: boolean;

  constructor(
    private readonly apiKey: string | undefined,
    readonly model: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 45_000,
  ) {
    this.configured = !!apiKey;
  }

  private async requestOnce(path: string, init: RequestInit): Promise<any> {
    if (!this.apiKey) throw new AppError(503, "ai_not_configured", "AI is not configured on the server.");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(BASE + path, {
        ...init,
        signal: ctrl.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      });
      if (!res.ok) {
        // Temporary diagnostic: log Google's actual status + body (never the key) to find out
        // why a non-timeout failure is happening. Safe to remove once the cause is confirmed.
        const bodyText = await res.text().catch(() => "");
        // eslint-disable-next-line no-console
        console.error("[gemini] upstream error", { status: res.status, body: bodyText.slice(0, 500) });
        throw mapStatus(res.status);
      }
      return await res.json();
    } catch (e) {
      if (e instanceof AppError) throw e;
      if ((e as { name?: string })?.name === "AbortError") throw new AppError(504, "ai_timeout", "The AI took too long to respond.");
      throw new AppError(502, "ai_network_error", "Could not reach the AI service.");
    } finally {
      clearTimeout(timer);
    }
  }

  /** Outbound calls to Google's API occasionally hang or drop on a flaky network path; one quiet retry
   *  on a timeout/network error smooths that over without the caller ever seeing it. */
  private async request(path: string, init: RequestInit): Promise<any> {
    try {
      return await this.requestOnce(path, init);
    } catch (e) {
      const retryable = e instanceof AppError && (e.code === "ai_timeout" || e.code === "ai_network_error");
      if (!retryable) throw e;
      return await this.requestOnce(path, init);
    }
  }

  async sendMessage(turns: ChatTurn[], opts: GenerateOptions = {}): Promise<string> {
    const body: Record<string, unknown> = {
      contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
      generationConfig: { maxOutputTokens: opts.maxOutputTokens ?? 2048 },
    };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    const data = await this.request(`/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const cand = data?.candidates?.[0];
    if (!cand) throw new AppError(422, "ai_blocked", "The AI could not answer this request.");
    if (cand.finishReason === "SAFETY" || cand.finishReason === "PROHIBITED_CONTENT") {
      throw new AppError(422, "ai_blocked", "The AI could not answer this request.");
    }
    const text = ((cand.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("");
    if (!text.trim()) throw new AppError(502, "ai_empty_response", "The AI returned an empty response.");
    return text;
  }

  async listModels(): Promise<string[]> {
    const data = await this.request("/models?pageSize=1000", { method: "GET" });
    return ((data?.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .sort();
  }
}
