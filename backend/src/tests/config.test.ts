import { describe, expect, it } from "vitest";
import { loadConfig } from "../config/env";
import { createLogger, scrubSecrets } from "../config/logger";

const good = {
  MONGODB_URI: "mongodb+srv://user:pa55w0rd@cluster.example.mongodb.net/?retryWrites=true",
  MONGODB_DB_NAME: "takna_ai",
  FIREBASE_PROJECT_ID: "p",
  FIREBASE_CLIENT_EMAIL: "svc@p.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "line1\\nline2",
};

describe("config validation", () => {
  it("loads valid config and expands the private key newlines", () => {
    const c = loadConfig(good);
    expect(c.port).toBe(10000);
    expect(c.firebase.privateKey).toBe("line1\nline2");
  });
  it("fails safely without echoing secret values", () => {
    try {
      loadConfig({ ...good, MONGODB_URI: "not-a-uri-SECRETVALUE", MONGODB_DB_NAME: "bad name!" });
      throw new Error("should have thrown");
    } catch (e) {
      const m = (e as Error).message;
      expect(m).toContain("MONGODB_URI");
      expect(m).toContain("MONGODB_DB_NAME");
      expect(m).not.toContain("SECRETVALUE");
    }
  });
  it("requires an explicit database name", () => {
    const { MONGODB_DB_NAME, ...rest } = good;
    expect(() => loadConfig(rest)).toThrow(/MONGODB_DB_NAME/);
  });
});

describe("secret redaction", () => {
  it("redacts sensitive and chat-content fields in logs", () => {
    let out = "";
    const log = createLogger("info", { write: (s: string) => { out += s; } } as any);
    log.info({ password: "hunter2", token: "tok123", content: "private chat text", req: { headers: { authorization: "Bearer abc" } }, nested: { apiKey: "KEY999" } }, "x");
    for (const s of ["hunter2", "tok123", "private chat text", "Bearer abc", "KEY999"]) expect(out).not.toContain(s);
    expect(out).toContain("[REDACTED]");
  });
  it("scrubs credentials from connection strings", () => {
    expect(scrubSecrets("fail mongodb+srv://u:p@host/db")).not.toContain("u:p");
  });
});
