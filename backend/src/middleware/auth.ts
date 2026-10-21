import type { RequestHandler } from "express";
import { maybePromoteInitialSuperAdmin, resolveUser } from "../repositories/users";
import type { DbProvider, Role, TokenVerifier, VerifiedToken } from "../types";
import { forbidden, unauthorized, unavailable } from "../utils/errors";
import { ah } from "../utils/http";

export function createAuth(deps: { db: DbProvider; verifyToken: TokenVerifier; initialSuperAdminEmail?: string }): RequestHandler {
  return ah(async (req, _res, next) => {
    const m = /^Bearer\s+(\S+)$/i.exec(req.header("authorization") ?? "");
    if (!m) throw unauthorized("Missing bearer token");
    let token: VerifiedToken;
    try {
      token = await deps.verifyToken(m[1]);
    } catch {
      throw unauthorized("Invalid or expired token", "invalid_token");
    }
    if (!deps.db.isReady()) throw unavailable("Database unavailable", "database_unavailable");
    const resolved = await resolveUser(deps.db.getDb(), token);
    const user = await maybePromoteInitialSuperAdmin(deps.db.getDb(), resolved, deps.initialSuperAdminEmail);
    if (user.status === "suspended") throw forbidden("Account suspended", "account_suspended");
    req.auth = { uid: user.uid, role: user.role, email: user.email, emailVerified: user.emailVerified, user };
    next();
  });
}

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(forbidden("Insufficient permissions"));
    next();
  };
