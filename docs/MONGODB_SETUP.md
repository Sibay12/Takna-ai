# MongoDB Atlas setup (TAKNA AI)

1. Atlas: select or create a project, then a cluster.
2. Prefer a NEW database named `takna_ai`. If you must share an existing database, run `npm run db:inspect` first; TAKNA AI only touches its 16 `ai_*` collections.
3. Database Access: create a dedicated user (not an admin). Use a custom role limited to your database:
   - `readWrite` on the TAKNA AI database, or finer: find/insert/update/remove/createIndex/createCollection/listCollections on the approved `ai_*` collections only.
4. Network Access: add Render's outbound IPs/your IP. Avoid `0.0.0.0/0` as the default; use it only temporarily if Render's IPs cannot be allow-listed, and document the risk.
5. Connect > Drivers: copy the `mongodb+srv://` URI.
6. URL-encode special characters in the password (`@` -> `%40`, `:` -> `%3A`, `/` -> `%2F`, `#` -> `%23`).
7. Render dashboard: set `MONGODB_URI` and `MONGODB_DB_NAME=takna_ai`.
8. Deploy, then verify `GET /ready` returns 200 and, in Atlas, that `ai_messages` and `ai_conversations` have the `ttl_expiresAt` index.
