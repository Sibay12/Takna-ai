import { describe, expect, it } from "vitest";
import { GeminiProvider } from "../services/gemini";

const reply = (status: number, body: unknown = {}) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const ok = { candidates: [{ content: { parts: [{ text: "नमस्ते " }, { text: "world" }] }, finishReason: "STOP" }] };
const turns = [{ role: "user" as const, content: "hi" }];

describe("GeminiProvider", () => {
  it("parses a successful response", async () => {
    const g = new GeminiProvider("K", "m", reply(200, ok));
    expect(await g.sendMessage(turns)).toBe("नमस्ते world");
  });
  it("sends the key as a header, not in the URL, and the model path", async () => {
    let seen: { url?: string; headers?: any } = {};
    const f = (async (url: string, init: any) => { seen = { url, headers: init.headers }; return new Response(JSON.stringify(ok)); }) as unknown as typeof fetch;
    await new GeminiProvider("SECRETKEY", "gemini-x", f).sendMessage(turns, { system: "s" });
    expect(seen.url).toContain("/models/gemini-x:generateContent");
    expect(seen.url).not.toContain("SECRETKEY");
    expect(seen.headers["x-goog-api-key"]).toBe("SECRETKEY");
  });
  it("maps provider errors without leaking the key", async () => {
    const cases: [number, number, string][] = [[429, 429, "ai_rate_limited"], [401, 502, "ai_provider_auth"], [403, 502, "ai_provider_auth"], [404, 502, "ai_model_unsupported"], [500, 502, "ai_provider_error"]];
    for (const [from, status, code] of cases) {
      const err: any = await new GeminiProvider("SECRETKEY", "m", reply(from)).sendMessage(turns).catch((e) => e);
      expect(err.status).toBe(status);
      expect(err.code).toBe(code);
      expect(JSON.stringify(err.message)).not.toContain("SECRETKEY");
    }
  });
  it("handles timeouts, network failures, blocked and empty answers", async () => {
    const abort = (async () => { const e: any = new Error("aborted"); e.name = "AbortError"; throw e; }) as unknown as typeof fetch;
    expect(((await new GeminiProvider("K", "m", abort).sendMessage(turns).catch((e) => e)) as any).code).toBe("ai_timeout");
    const down = (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    expect(((await new GeminiProvider("K", "m", down).sendMessage(turns).catch((e) => e)) as any).code).toBe("ai_network_error");
    expect(((await new GeminiProvider("K", "m", reply(200, { candidates: [{ finishReason: "SAFETY" }] })).sendMessage(turns).catch((e) => e)) as any).code).toBe("ai_blocked");
    expect(((await new GeminiProvider("K", "m", reply(200, { candidates: [{ content: { parts: [] } }] })).sendMessage(turns).catch((e) => e)) as any).code).toBe("ai_empty_response");
  });
  it("is clearly unconfigured without a key", async () => {
    const g = new GeminiProvider(undefined, "m", reply(200, ok));
    expect(g.configured).toBe(false);
    expect(((await g.sendMessage(turns).catch((e) => e)) as any).code).toBe("ai_not_configured");
  });
  it("lists only generateContent models", async () => {
    const body = { models: [{ name: "models/a", supportedGenerationMethods: ["generateContent"] }, { name: "models/emb", supportedGenerationMethods: ["embedContent"] }] };
    expect(await new GeminiProvider("K", "m", reply(200, body)).listModels()).toEqual(["a"]);
  });
});
