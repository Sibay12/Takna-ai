# TAKNA AI - Android app (Phase 2 foundation)

Kotlin + Jetpack Compose + Material 3 + Navigation Compose. Package: `com.takna.ai`. minSdk 26, targetSdk 35.

## What is in this phase
Branding (launcher icon, splash, logo), dark Jarvis-style theme, animated AI orb, navigation for all 24 screens,
and the real Splash, Onboarding, Login/Register (UI only), Home, Chat (preview only), More and About screens.
Every screen that depends on a later phase says so on screen. Nothing is faked: sign-in, chat replies and voice
are NOT connected yet.

## Not in this phase (deliberately)
Firebase/Google sign-in (Phase 3), Gemini chat via backend (Phase 5), microphone/TTS/app launching (Phase 6),
Coding Studio (Phase 7), subscriptions (Phase 10). Hilt, Retrofit, Room and DataStore are added when first used.

## Build
- CI: push to GitHub; the "Android debug build" workflow produces `takna-ai-debug-apk` (debug-signed, for testing only).
- Local: Android Studio (JDK 17) -> open `android-app/` -> Run. Or `gradle assembleDebug` with Gradle 8.10.2.
- This is a debug build. A signed release build needs your own keystore (never commit it).
