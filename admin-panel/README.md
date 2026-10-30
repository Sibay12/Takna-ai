# TAKNA AI - Admin Panel (Phase 8)

Next.js (App Router) + TypeScript. Talks only to the existing backend admin APIs (docs/API.md) -
it holds no data of its own and stores no secrets client-side beyond the normal Firebase web config.

## What is here
- Firebase email/password sign-in. After sign-in it calls `GET /me`; only `ADMIN` / `SUPER_ADMIN`
  accounts get into the dashboard. Roles are managed on TAKNA AI's own database, not here.
- **Users**: search, suspend / reactivate.
- **AI providers** (SUPER_ADMIN only): add, edit, enable/disable, set the default, test the
  connection, and delete AI connections (Gemini / Anthropic / OpenAI). The API key is only ever
  sent once, to save or replace it; it is never shown again, only a masked hint.
- **Retention**: read-only view of the mandatory 7-day chat retention.

## Environment variables (set in Render -> Environment; see .env.example)
- `NEXT_PUBLIC_API_BASE` - the backend's API base, e.g. `https://takna-ai.onrender.com/api/v1`.
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
  `NEXT_PUBLIC_FIREBASE_APP_ID` - from Firebase console -> Project settings -> Your apps -> **Web** app
  (add one if there isn't one yet). These are client config, not secrets - Firebase expects them in
  the browser.
- On the **backend** service, `CORS_ORIGINS` must include this admin panel's own URL, comma-separated
  with any other allowed origins, or the browser will block the API calls.

## Build
- CI: push to GitHub; "Admin panel CI" runs `typecheck` and `build`.
- Render: a Node web service with root directory `admin-panel/`, build `npm install && npm run build`,
  start `npm start`, same as the backend service.
