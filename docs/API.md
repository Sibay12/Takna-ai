# API (implemented in v0.1.0)
Auth: `Authorization: Bearer <FIREBASE_ID_TOKEN>`. Errors: `{ "error": { "code", "message" } }`.

Public: `GET /health`, `GET /ready`, `GET /api/v1/subscriptions/plans`
User: `GET|PATCH /api/v1/me`; projects `GET|POST /projects`, `GET|PATCH|DELETE /projects/:projectId`, `GET|PUT /projects/:projectId/files`; `GET|POST /conversations`, `GET /conversations/:id/messages`, `DELETE /conversations/:id`
AI: `POST /ai/chat` (stored 7 days; body `mode: "voice"` returns short plain spoken-style answers for the voice-only screen), `POST /ai/code` (not stored; tasks generate/analyze/debug/website/summarize), `GET /ai/status`, `GET /usage`
Admin (ADMIN, SUPER_ADMIN): `GET /admin/retention`, `GET /admin/users`, `PATCH /admin/users/:userId/status`, `GET /admin/gemini` (status + connection test + available models)

Not yet: streaming responses, subscriptions (me/checkout/cancel/history), `/entitlements/me`, other admin routes.
