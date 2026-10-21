import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { badRequest } from "./errors";

export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    throw badRequest(`${i.path.join(".") || "body"}: ${i.message}`, "validation_error");
  }
  return r.data;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
