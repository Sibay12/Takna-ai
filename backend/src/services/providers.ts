import { AppError } from "../utils/errors";
import { mapStatus, type AiProvider, type ChatTurn, type GenerateOptions } from "./gemini";

async function callJson(fetchFn: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw mapStatus(res.status);
    return await res.json();
  } catch (e) {
    if (e instanceof AppError) throw e;
    if ((e as { name?: string })?.name === "AbortError") throw new AppError(504, "ai_timeout", "The AI took too long to respond.");
    throw new AppError(502, "ai_network_error", "Could not reach the AI service.");
  } finally {
    clearTimeout(timer);
  }
}

/** Providers need strictly alternating roles starting with "user". Merge neighbours of the same role. */
export function normalizeTurns(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += "\n\n" + t.content;
    else out.push({ ...t });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export class AnthropicProvider implements AiProvider {
  readonly configured = true;
  constructor(private readonly apiKey: string, readonly model: string, private readonly fetchFn: typeof fetch = fetch, private readonly timeoutMs = 45_000) {}

  private headers() {
    return { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" };
  }

  async sendMessage(turns: ChatTurn[], opts: GenerateOptions = {}): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: opts.maxOutputTokens ?? 2048,
      messages: normalizeTurns(turns).map((t) => ({ role: t.role, content: t.content })),
    };
    if (opts.system) body.system = opts.system;
    const data = await callJson(this.fetchFn, "https://api.anthropic.com/v1/messages", { method: "POST", headers: this.headers(), body: JSON.stringify(body) }, this.timeoutMs);
    if (data?.stop_reason === "refusal") throw new AppError(422, "ai_blocked", "The AI could not answer this request.");
    const text = ((data?.content ?? []) as { type?: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    if (!text.trim()) throw new AppError(502, "ai_empty_response", "The AI returned an empty response.");
    return text;
  }

  async listModels(): Promise<string[]> {
    const data = await callJson(this.fetchFn, "https://api.anthropic.com/v1/models?limit=100", { method: "GET", headers: this.headers() }, this.timeoutMs);
    return ((data?.data ?? []) as { id: string }[]).map((m) => m.id).sort();
  }
}

export class OpenAiProvider implements AiProvider {
  readonly configured = true;
  constructor(private readonly apiKey: string, readonly model: string, private readonly fetchFn: typeof fetch = fetch, private readonly timeoutMs = 45_000) {}

  private headers() {
    return { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` };
  }

  async sendMessage(turns: ChatTurn[], opts: GenerateOptions = {}): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    for (const t of turns) messages.push({ role: t.role, content: t.content });
    const body = { model: this.model, messages, max_completion_tokens: opts.maxOutputTokens ?? 2048 };
    const data = await callJson(this.fetchFn, "https://api.openai.com/v1/chat/completions", { method: "POST", headers: this.headers(), body: JSON.stringify(body) }, this.timeoutMs);
    const choice = data?.choices?.[0];
    if (choice?.finish_reason === "content_filter") throw new AppError(422, "ai_blocked", "The AI could not answer this request.");
    const text = String(choice?.message?.content ?? "");
    if (!text.trim()) throw new AppError(502, "ai_empty_response", "The AI returned an empty response.");
    return text;
  }

  async listModels(): Promise<string[]> {
    const data = await callJson(this.fetchFn, "https://api.openai.com/v1/models", { method: "GET", headers: this.headers() }, this.timeoutMs);
    return ((data?.data ?? []) as { id: string }[]).map((m) => m.id).sort();
  }
}
