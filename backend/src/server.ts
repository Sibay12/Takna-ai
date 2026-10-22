import { loadConfig } from "./config/env";
import { createLogger } from "./config/logger";
import { createApp } from "./app";
import { DbManager } from "./database/connection";
import { startKeepAlive } from "./jobs/keepAlive";
import { startRetentionJob } from "./jobs/retentionJob";
import { GeminiProvider } from "./services/gemini";
import { initFirebase, revokeSessions, verifyIdToken } from "./services/firebase";

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(e instanceof Error ? e.message : "Invalid configuration"); // names/rules only, never values
    process.exit(1);
  }
  const log = createLogger(config.logLevel);
  initFirebase(config.firebase);

  const db = new DbManager(config.mongoUri, config.dbName, log);
  const app = createApp({ corsOrigins: config.corsOrigins, db, verifyToken: verifyIdToken, revokeSessions, log, initialSuperAdminEmail: config.initialSuperAdminEmail, ai: new GeminiProvider(config.geminiApiKey, config.geminiModel), aiLimits: { dailyRequests: config.aiDailyRequests, maxOutputTokens: config.aiMaxOutputTokens } });

  const server = app.listen(config.port, "0.0.0.0", () => log.info({ port: config.port }, "server listening"));
  server.requestTimeout = 60_000;
  server.headersTimeout = 20_000;

  void db.connectWithRetry(); // /health works immediately; /ready flips once DB is initialized
  const stopJob = startRetentionJob(db, log);
  const stopPing = config.keepAliveUrl ? startKeepAlive({ url: config.keepAliveUrl, log }) : undefined;

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, "shutting down");
    stopJob();
    stopPing?.();
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => {
      db.close().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (r) => log.error({ reason: r instanceof Error ? r.name : "unknown" }, "unhandledRejection"));
}

main();
