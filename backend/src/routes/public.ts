import { Router } from "express";
import { col } from "../database/collections";
import type { DbProvider } from "../types";
import { ah } from "../utils/http";

export function healthRouter(db: DbProvider): Router {
  const r = Router();
  r.get("/health", (_req, res) => {
    res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
  });
  r.get("/ready", ah(async (_req, res) => {
    const ok = db.isReady() && (await db.ping());
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not_ready", database: ok ? "up" : "down" });
  }));
  return r;
}

/** Public plan list. Prices come only from admin-configured documents; nothing is invented. */
export function plansRouter(db: DbProvider): Router {
  const r = Router();
  r.get("/subscriptions/plans", ah(async (_req, res) => {
    const plans = await col(db.getDb(), "ai_subscription_plans")
      .find({ active: true }, { projection: { _id: 0, planId: 1, name: 1, priceMinor: 1, currency: 1, billingPeriod: 1, entitlements: 1 } })
      .toArray();
    res.json({ plans });
  }));
  return r;
}
