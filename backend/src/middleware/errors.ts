import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { scrubSecrets } from "../config/logger";
import { AppError } from "../utils/errors";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
};

export const errorHandler =
  (log: Logger): ErrorRequestHandler =>
  (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    if (err?.type === "entity.too.large") {
      res.status(413).json({ error: { code: "payload_too_large", message: "Request body too large" } });
      return;
    }
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: { code: "invalid_json", message: "Malformed JSON" } });
      return;
    }
    if (typeof err?.name === "string" && err.name.startsWith("MongoServerSelection")) {
      res.status(503).json({ error: { code: "database_unavailable", message: "Database unavailable" } });
      return;
    }
    log.error({ err: { name: err?.name, message: scrubSecrets(String(err?.message ?? "")) } }, "unhandled error");
    res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
  };
