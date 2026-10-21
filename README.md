# TAKNA backend (Render free tier)

Node + Express + MongoDB Atlas (free). Render's free disk is wiped on every deploy/restart, so data lives in Atlas, not on Render.

## Deploy
1. **MongoDB Atlas**: create a free M0 cluster, add a database user, under Network Access allow `0.0.0.0/0`, copy the connection string.
2. **GitHub**: push this folder to a new repo.
3. **Render**: New > Web Service > your repo. Runtime Node, Build `npm install`, Start `npm start`, Instance type Free.
4. **Environment variables** (see `.env.example`): `MONGODB_URI`, `JWT_SECRET` (long random text), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
5. Open `https://YOUR-APP.onrender.com/admin`, sign in with the admin email/password.
6. In the portal: **AI & Keys** (paste your API key), **App** (Google Client ID), **Limits**, **Ads**, **Codes**.

## Self-ping
The server pings its own `/healthz` every 10 minutes (set 1 to 14 minutes, or switch it off, in Admin > Dashboard) so Render's free instance doesn't sleep. Render provides `RENDER_EXTERNAL_URL` automatically; elsewhere set `PUBLIC_URL`. A self-ping can't wake a server that is already asleep, so also add a free UptimeRobot monitor on `/healthz` as a backup. One always-on free service uses about 720 of Render's 750 free hours per month.

## Google login
Google Cloud Console > Credentials > OAuth client ID (Web). Add your Render URL (and the client app URL) under Authorized JavaScript origins. Paste the Client ID in Admin > App. The client sends the Google `credential` to `POST /api/auth/google`.

## API
- `GET /api/config` public: name, announcement, maintenance, googleClientId, active ads (show ads only when `user.plan==='free'`)
- `POST /api/auth/register | login | google`
- `GET /api/me`
- `POST /api/chat` `{messages:[{role,content}]}` returns `{text, remaining}`; 429 for cool-down or daily limit
- `POST /api/redeem` `{code}` upgrades to Pro
- `/api/admin/*` admin only

## App updates
Admin > Updates: set latest/minimum version, APK link, changelog, and Force update. Apps call `GET /api/update?v=CURRENT_VERSION` and get `{updateAvailable, force, latest, url, changelog}`.

## Payments (TAKNAPAY)
Admin > Payments. TAKNAPAY's API docs were not publicly reachable when this was built, so endpoint paths, header names and field names are settings you fill in from their docs, not hard-coded guesses. Flow: app calls `POST /api/pay/create {planId}` and opens the returned `payUrl`; TAKNAPAY calls `/api/pay/webhook`; the server verifies the HMAC-SHA256 signature of the raw body (and optionally re-checks the status API), then grants Pro once (duplicate webhooks are safe). `GET /api/pay/status/:orderId` lets the app poll after returning. Use "Mark paid" for manual fixes.

## Optimization
gzip, 30s settings cache, DB indexes, static caching, and Admin > Optimize (uptime, memory, DB ping, cleanup tools).

## Shared MongoDB
This project only uses collections prefixed `ai_` (`ai_users`, `ai_settings`, `ai_codes`, `ai_orders`), so other projects in the same database are untouched. To fully separate, set `DB_NAME=takna`.

## Chat history
Opt-in per user. `GET /api/history`, `PUT /api/history/consent {on}`, `DELETE /api/history`. Saved automatically by `/api/chat` when the user opted in. Stored in MongoDB (`ai_chats`), never on Render's disk. Capped per user, truncated per message, purged after the retention period (every 6 hours). Admins cannot read message content. Atlas M0 free storage is 512 MB shared by everything in the cluster; watch "DB MB used" in Admin > Optimize.

History is kept for at most 7 days (default and hard cap); older messages are deleted automatically.

## Android APK
The app is a thin native shell (`android/`) around the web app in `public/index.html`, with native voice input. GitHub Actions builds it: Actions > Build APK > Run workflow. The APK is attached to a new Release. Stable download link (repo must be public):
`https://github.com/Sibay12/Takna-ai/releases/latest/download/takna-assist.apk`
Paste that link in Admin > Updates. To change the server URL edit `base` in `MainActivity.kt`. Raise `versionCode`/`versionName` in `android/app/build.gradle.kts` for each new release. This is a debug-signed APK for sideloading; Play Store needs a release keystore.
