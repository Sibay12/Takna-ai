# Firebase setup for TAKNA AI (Phase 3)

The Android app signs users in with Firebase Authentication (email/password + Google).
Without `android-app/app/google-services.json` the app still builds and says "sign-in not configured".

1. console.firebase.google.com -> Add project (e.g. "takna-ai").
2. Build -> Authentication -> Get started -> enable **Email/Password** and **Google**.
3. Project settings -> Your apps -> Add **Android** app.
   - Package name: `com.takna.ai`
   - Debug SHA-1:   `D6:02:1F:5C:EA:10:1F:C6:39:8D:E1:9B:24:B0:BB:21:E4:75:B9:F3`
   - Debug SHA-256: `7E:D5:52:F9:61:3C:DF:21:86:C0:A4:D3:D3:87:61:54:39:50:08:0F:00:81:3E:A1:AE:1A:5D:33:7C:02:FE:92`
   (These belong to the fixed debug key `android-app/app/takna-debug.keystore`. A release key needs its own SHA-1.)
4. Download `google-services.json` (after enabling Google sign-in, so it contains the web client) and put it at
   `android-app/app/google-services.json` (GitHub: Add file -> Upload files). It is client config, not a secret.
5. Backend (Render env vars) from Project settings -> Service accounts -> Generate key:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (keep `\n` sequences). Never commit this key.
6. Set `INITIAL_SUPER_ADMIN_EMAIL` on Render to your own VERIFIED email.
