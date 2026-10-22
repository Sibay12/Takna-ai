import { describe, expect, it } from "vitest";
import { loadConfig } from "../config/env";
import { createLogger } from "../config/logger";
import { pingOnce, startKeepAlive } from "../jobs/keepAlive";

const base = {
  MONGODB_URI: "mongodb+srv://u:p@c.example.net/",
  MONGODB_DB_NAME: "takna_ai",
  FIREBASE_PROJECT_ID: "p",
  FIREBASE_CLIENT_EMAIL: "s@p.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "k",
};

describe("keep-alive", () => {
  it("pings /health on the public URL on an interval and can be stopped", async () => {
    const urls: string[] = [];
    const f = (async (u: string) => { urls.push(u); return new Response("{}"); }) as unknown as typeof fetch;
    const stop = startKeepAlive({ url: "https://x.onrender.com/", log: createLogger("silent"), intervalMs: 10, fetchFn: f });
    await new Promise((r) => setTimeout(r, 70));
    stop();
    const n = urls.length;
    expect(n).toBeGreaterThan(0);
    expect(urls[0]).toBe("https://x.onrender.com/health");
    await new Promise((r) => setTimeout(r, 40));
    expect(urls.length).toBe(n);
  });
  it("a failing ping returns false instead of throwing", async () => {
    const f = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await pingOnce("https://x/health", f)).toBe(false);
  });
  it("is enabled only in production with a URL, and can be switched off", () => {
    expect(loadConfig({ ...base, NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://x.onrender.com" }).keepAliveUrl).toBe("https://x.onrender.com");
    expect(loadConfig({ ...base, NODE_ENV: "production", RENDER_EXTERNAL_URL: "https://x.onrender.com", KEEP_ALIVE: "false" }).keepAliveUrl).toBeUndefined();
    expect(loadConfig({ ...base, NODE_ENV: "development", RENDER_EXTERNAL_URL: "https://x.onrender.com" }).keepAliveUrl).toBeUndefined();
    expect(loadConfig({ ...base, NODE_ENV: "production" }).keepAliveUrl).toBeUndefined();
  });
});
