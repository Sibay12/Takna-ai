# TAKNA AI Backend

Node.js + TypeScript + Express + MongoDB. Product of TAKNA TECHNOLOGY (SIBAYAN ENTERPRISE).

## Quick start
1. `cd backend && npm install` (optional locally; Render runs `npm install` itself via render.yaml)
2. `cp .env.example .env` and fill in real values (never commit `.env`)
3. `npm run typecheck && npm test`
4. `npm run dev`
5. Check `GET /health` (always 200) and `GET /ready` (200 only when MongoDB is connected and initialized)

## Environment variables
| Variable | Required | Purpose |
|---|---|---|
| NODE_ENV | no | development / test / production |
| PORT | no | default 10000, binds 0.0.0.0 |
| MONGODB_URI | yes | Atlas URI of a dedicated least-privilege user |
| MONGODB_DB_NAME | yes | explicit DB name, prefer `takna_ai` (app refuses to start without it) |
| FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY | yes | Firebase Admin SDK (token verification) |
| CORS_ORIGINS | no | comma-separated admin panel origins; no wildcard |
| ADMIN_BOOTSTRAP_SECRET | for bootstrap | min 16 chars, used only by `npm run admin:bootstrap` |
| GEMINI_API_KEY | Phase 5 | server-side only |
| LOG_LEVEL | no | default info |

Config errors list variable names and rules only, never values.

## Database safety (shared MongoDB server)
- Only the 16 allowlisted `ai_*` collections are ever used (`src/database/collections.ts`). A prefix alone is not authorization; `col()` is the only way to get a collection handle.
- Startup is idempotent and non-destructive: creates only MISSING approved collections and approved indexes. Conflicting existing indexes are reported, never dropped.
- No `dropDatabase`, `drop`, rename, or unfiltered deletes anywhere (enforced by a test that scans the source).
- Before first run on a shared server: `npm run build && npm run db:inspect` lists collection names only and shows what would be created.

## 7-day chat retention (all plans)
- Every message: `expiresAt = createdAt + 7 days`, computed per message, never extended.
- Conversation `expiresAt` follows its newest message so it never expires before its messages.
- TTL indexes (`expireAfterSeconds: 0`) on `ai_messages` and `ai_conversations`, created at startup.
- Because TTL is asynchronous, the API also filters `expiresAt > now`, rejects expired conversations (410), and a safety-net cleanup job runs every 15 min with retries.
- `DELETE /conversations/:id` reports success only after re-counting zero remaining documents.
- `GET /admin/retention` shows policy, TTL index status, overdue-but-unpurged counts and last cleanup. There is deliberately no endpoint to change the policy.
- Provider-side (Gemini) and Atlas backup retention are separate and are not claimed to be erased immediately.

## Super admin
Roles live only in the database. On Render Free (no shell) set `INITIAL_SUPER_ADMIN_EMAIL` in the dashboard: that person becomes SUPER_ADMIN the first time they sign in with that exact VERIFIED email, and only while no super admin exists (audited). Remove the variable afterwards.
With a shell elsewhere you can instead run `npm run admin:bootstrap -- you@example.com --secret=<ADMIN_BOOTSTRAP_SECRET>`.

## Render
Push the WHOLE `takna-ai` folder to GitHub (`render.yaml` must be in the repo root; it builds `backend/`). In Render: New > Blueprint > pick the repo. Build errors appear in the Render build log. Set secrets in the Render dashboard. Free instances sleep when idle; no keep-alive pings are used. Retention does not depend on Render being awake (Atlas TTL).

## Not done yet
Gemini routes, subscriptions/entitlements, TaknaPay, admin dashboard/plans/settings/audit-log routes. See `docs/PROGRESS.txt`.
