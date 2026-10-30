# Admin Panel setup (Phase 8)

The Admin Panel is live at https://takna-ai-admin.onrender.com but cannot sign anyone in yet: it
needs a **Web** app in the same Firebase project, which Android's google-services.json doesn't give.

1. console.firebase.google.com -> project "takna-ai" -> Project settings -> Your apps -> **Add app** -> Web (</>).
   - App nickname: "TAKNA AI Admin" (no hosting setup needed).
2. It shows a `firebaseConfig` object. Send me (or set directly in Render -> takna-ai-admin -> Environment)
   these four values from it - they are public client config, not secrets:
   - `NEXT_PUBLIC_FIREBASE_API_KEY` = apiKey
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = authDomain
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = projectId
   - `NEXT_PUBLIC_FIREBASE_APP_ID` = appId
3. Make sure **Email/Password** sign-in is enabled (Authentication -> Sign-in method) - it already is,
   from Phase 3.
4. Sign in to the Admin Panel with an account whose role is `ADMIN` or `SUPER_ADMIN`. The very first
   super admin is created by signing in with the email in `INITIAL_SUPER_ADMIN_EMAIL` on the backend
   (already set up in Phase 2/Firebase setup) - use that same account here. A super admin can promote
   others later (role management via `/admin/users` - a PATCH role endpoint is not built yet, so for
   now ask and I will add it, or set the role directly in MongoDB).
5. Already done for you: the backend's `CORS_ORIGINS` includes `https://takna-ai-admin.onrender.com`,
   and `KEY_ENCRYPTION_SECRET` (from the AI-providers phase) must already be set for the "AI providers"
   page to be able to save keys.
