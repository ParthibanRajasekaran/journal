# ADR-003: Client framework for web, Android, and iOS

## Status

Proposed, 2026-10-29. Supersedes the default in PRD section 11 only after acceptance.

## Context

The PRD requires one UI codebase for web (responsive), Android, and iOS; an open-source cross-platform framework; biometric unlock (Face ID, Touch ID, Android BiometricPrompt) backed by Keychain/Secure Enclave or Android Keystore; offline logging with a sync queue (FR-8); small app size and cold start under 2 s on a mid-range phone.

The repo already has a React 19 + Vite app with `@capacitor/core`, `@capacitor/android`, and `@capacitor/ios` 8.x, plus `android/` and `ios/` native projects. `src/` contains the UI, `src/db/sqliteManager.ts` (sql.js persisted to IndexedDB), `src/utils/syncManager.ts`, and `src/services/biometricAuth.ts`. That last file stores a `journal_security_passcode` in localStorage, which conflicts with FR-3 (no PIN anywhere) and must be removed in any option.

## Decision

Keep one React + Vite codebase and wrap it with Capacitor (MIT). Use native plugins for the secure parts:

- Biometric unlock: `@capgo/capacitor-native-biometric` 8.9.1 (MPL-2.0, published 2026-10-20). It wraps Face ID/Touch ID and BiometricPrompt and can store credentials behind the platform keystore. Verify the credential-storage behaviour in its docs before relying on it.
- Secure storage for refresh tokens and AI keys: `@aparajita/capacitor-secure-storage` 8.0.1 (MIT, published 2026-09-23), backed by Keychain and Android Keystore.
- Offline store and sync queue: `@capacitor-community/sqlite` 8.1.1 (MIT, published 2026-08-06), with the queue in SQLite and photos in the app filesystem. Replace the sql.js/IndexedDB store on native; keep it on web.

Web keeps the responsive build. Native builds use the same `dist/` output.

## Alternatives considered

**React Native with Expo.** Expo SDK 58.0.21 (MIT, npm) and React Native 0.88.1 (MIT, published 2026-10-27). Expo Local Authentication and Expo SecureStore (`expo-secure-store` 58.0.2, MIT) cover biometrics and keychain/keystore. Strengths: true native UI and mature offline tooling. Weaknesses: the web target needs react-native-web, so the existing Tailwind/Vite UI and Motion-based components would be rewritten. Requirement for one UI codebase is met only by rebuilding it. Cost is a rewrite of roughly all of `src/components/`.

**Flutter.** Flutter 3.47.8 stable (BSD-3-Clause, released 2026-10-23). `local_auth` 3.0.2 (BSD-3-Clause repo, published 2026-07-09) and `flutter_secure_storage` 11.2.0 (published 2026-09-16; license to confirm, its repo was moved). Strengths: one rendering engine, consistent UI. Weaknesses: Dart rewrite of the whole app, web output is a separate renderer with weaker responsive/SEO characteristics, larger engine footprint, and no code reuse from the React app.

**Capacitor (chosen).** Reuses the React codebase, existing Android/iOS projects, and the Vite pipeline. Smallest app shell among the three options because the UI is bundled as web assets. Trade-off: UI runs in a WebView, so very heavy animation or scroll-intensive screens need care.

**Trade-off of reuse versus rewrite.** Reuse saves the bulk of the UI effort and keeps web and native identical, but it carries existing debt: the localStorage passcode, the sql.js-in-IndexedDB store, and a dev server (`server.ts`) that must not ship to native. A rewrite (Expo or Flutter) removes that debt but costs most of the MVP schedule and creates two UI codebases during migration.

## Consequences

- Remove the passcode path in `biometricAuth.ts`; biometric unlock gates a token held in the secure store.
- Add a native SQLite adapter behind a single storage port, so `syncManager` and the sync queue are shared across platforms.
- Keep `capacitor.config.ts` `cleartext: true` out of release builds; all API traffic must be TLS (PRD section 6).
- Plugin count is small and all are MIT or MPL-2.0, so no copyleft code is linked into the app beyond file-level MPL obligations.
- Stay on Capacitor 8.x; upgrade when new majors ship.

## Open risks

- `@capgo/capacitor-native-biometric` is MPL-2.0 and single-maintainer; verify credential storage on Android API levels in use and keep a fallback plugin ready.
- WebView performance on low-end Android for the Today and Week screens is unmeasured; benchmark against the 2 s cold-start target before release.
- Native SQLite adds a second storage path; sync conflicts and photo loss (FR-8) need device tests on both platforms.
- Plugin versions dated 2026 were read from registry metadata; check release notes at implementation time.
- App size and start time are not yet measured for any option.

## Sources

Read 2026-10-29 unless noted.

- https://registry.npmjs.org/@capacitor/core (8.6.0, MIT, published 2026-10-28)
- https://registry.npmjs.org/@capgo/capacitor-native-biometric (8.9.1, MPL-2.0, published 2026-10-20)
- https://github.com/Cap-go/capacitor-native-biometric (repo license MPL-2.0, via GitHub API)
- https://registry.npmjs.org/@aparajita/capacitor-secure-storage (8.0.1, MIT, published 2026-09-23)
- https://github.com/aparajita/capacitor-secure-storage (repo license MIT)
- https://registry.npmjs.org/@capacitor-community/sqlite (8.1.1, MIT, published 2026-08-06)
- https://github.com/capacitor-community/sqlite (repo license MIT)
- https://registry.npmjs.org/expo (58.0.21, MIT, published 2026-10-28)
- https://registry.npmjs.org/expo-secure-store (58.0.2, MIT, published 2026-10-01)
- https://registry.npmjs.org/expo-local-authentication (58.0.2, MIT; date not stated)
- https://registry.npmjs.org/react-native (0.88.1, MIT, published 2026-10-27)
- https://registry.npmjs.org/react-native-biometrics (3.0.1, MIT, published 2022-09-06; stale, not chosen)
- https://registry.npmjs.org/capacitor-native-biometric (4.2.2, MIT, published 2023-06-14; stale, not chosen)
- https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json (Flutter 3.47.8 stable, 2026-10-23)
- https://pub.dev/api/packages/local_auth (3.0.2, published 2026-07-09)
- https://pub.dev/api/packages/flutter_secure_storage (11.2.0, published 2026-09-16)
- https://github.com/flutter/packages (repo license BSD-3-Clause, via GitHub API)
- https://github.com/mogol/flutter_secure_storage (moved; license not verified)
