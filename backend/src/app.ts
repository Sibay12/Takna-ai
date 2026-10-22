import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { Logger } from "pino";
import { createAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { adminRouter } from "./routes/admin";
import { aiRouter, type AiLimits } from "./routes/ai";
import type { AiProvider } from "./services/gemini";
import { conversationsRouter } from "./routes/conversations";
import { meRouter } from "./routes/me";
import { projectsRouter } from "./routes/projects";
import { healthRouter, plansRouter } from "./routes/public";
import type { DbProvider, TokenVerifier } from "./types";
import { unavailable } from "./utils/errors";

export interface AppDeps {
  corsOrigins: string[];
  db: DbProvider;
  verifyToken: TokenVerifier;
  revokeSessions: (uid: string) => Promise<void>;
  log: Logger;
  ai: AiProvider;
  aiLimits: AiLimits;
  rateLimitMax?: number;
  initialSuperAdminEmail?: string;
}

export function createApp(deps: AppDeps): Express {
  const { db, log } = deps;
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render sits behind one proxy

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || deps.corsOrigins.includes(origin)),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => log.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }, "request"));
    next();
  });

  app.use(healthRouter(db));

  const api = express.Router();
  api.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: deps.rateLimitMax ?? 300, standardHeaders: true, legacyHeaders: false }));
  api.use((_req, _res, next) => (db.isReady() ? next() : next(unavailable("Database unavailable", "database_unavailable"))));
  api.use(plansRouter(db)); // public
  api.use(createAuth({ db, verifyToken: deps.verifyToken, initialSuperAdminEmail: deps.initialSuperAdminEmail })); // everything below needs a verified user
  api.use(meRouter(db));
  api.use(aiRouter({ db, ai: deps.ai, limits: deps.aiLimits }));
  api.use(projectsRouter(db));
  api.use(conversationsRouter(db));
  api.use(adminRouter({ db, ai: deps.ai, revokeSessions: deps.revokeSessions, log }));
  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(errorHandler(log));
  return app;
}
