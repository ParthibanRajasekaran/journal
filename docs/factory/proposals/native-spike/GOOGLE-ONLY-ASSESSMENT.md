# Google-only native sign-in without the Facebook SDK: assessment

Status: assessment. No code or generated file was changed for this. Verified 1 November 2026.

## What is linked today

- The social-login plugin (`@capgo/capacitor-social-login` 8.7.5, MPL-2.0) has an iOS Swift package whose target
  depends unconditionally on `FacebookCore` and `FacebookLogin` (facebook-ios-sdk 18.1.1), in addition to
  `GoogleSignIn` (GoogleSignIn-iOS 9.x, Apache-2.0). See `web/node_modules/@capgo/capacitor-social-login/Package.swift`.
- Capacitor sync writes `web/ios/App/CapApp-SPM/Package.swift` from the plugin's package list. Any edit to the plugin's
  Package.swift inside `node_modules` is silently reverted by `npm install` or `cap sync`. So a fix in `node_modules`
  does not count as a fix.
- Android gates Facebook behind `includeFacebook` (plugin `build.gradle`). The default Android build does not compile it.

## Options

| Option | Effect | Cost | Verdict |
|---|---|---|---|
| A. Patch the plugin's Package.swift in node_modules | Removes Facebook from the build | Reverted by install and sync, so it never holds. | Rejected |
| B. Fork the plugin, remove Facebook, depend on the fork | Removes Facebook, durable | The fork is a modified MPL-2.0 file, so its source must be published. Maintenance burden. | Possible, not preferred |
| C. Small in-repo Capacitor plugin that calls GoogleSignIn-iOS and androidx Credential Manager directly | No Facebook, no MPL file to publish, all code owned by the repo | Native code to write and test on both platforms | **Recommended** |

## Smallest replacement for option C (not applied)

1. `web/plugins/journal-google-auth/` (new, our code):
   - `package.json` with `name` and a `capacitor` block, consumed as `"@journal/google-auth": "file:plugins/journal-google-auth"`.
   - `ios/Sources/JournalGoogleAuth/`: one Swift plugin class, about 80 lines, calling `GIDSignIn` with the iOS client
     ID and a server client ID, returning `idToken`. Depends on `GoogleSignIn` (9.x) only.
   - `android/src/main/java/.../JournalGoogleAuthPlugin.kt`: one plugin class, about 90 lines, using
     `androidx.credentials` with `GetGoogleIdOption` (server client ID, nonce) and returning `idToken`.
2. `web/src/native/platform.ts`: swap the import of `@capgo/capacitor-social-login` for the local plugin's `login(nonce)`
   method. The orchestration in `auth.ts` does not change.
3. `web/package.json`: remove `@capgo/capacitor-social-login`, add the file dependency. Capacitor sync then writes the
   new package into the generated Package.swift and Gradle files, so nothing generated is hand-edited.
4. Tests: the existing `auth.test.ts` and `race.test.ts` are unchanged, because they inject the device adapter.

Estimated size: about 200 lines native, about 30 lines TypeScript, plus tests. The native parts need a device check.

## Dependency inventory after option C

| Dependency | Version | Licence (evidence) | Notes |
|---|---|---|---|
| GoogleSignIn-iOS | 9.x | Apache-2.0. Read from `google/GoogleSignIn-iOS` LICENSE, 1 November 2026. | Keep licence and NOTICE. |
| androidx.credentials, credentials-play-services-auth | 1.5.0 | Apache-2.0. Read from the POM in the local Gradle cache. | Keep notices. |
| com.google.android.libraries.identity.googleid | 1.1.1 | **Android Software Development Kit License** (Google terms), from its POM. | Not an open-source licence. Standard for Google sign-in on Android. Acceptable for distribution inside Android apps under those terms. Read the terms before release. |
| com.google.android.gms:play-services-auth | 21.4.0 | Android Software Development Kit License, from its POM. | Same terms as above. |
| @capacitor/* | 8.5.3 | MIT | Keep notice. |
| @aparajita/capacitor-secure-storage | 8.0.1 | MIT (LICENSE file in package) | Keep notice. |

Removed by option C: facebook-ios-sdk (Meta licence, scope limited to Facebook's services, subject to Facebook's platform
policy). The MPL-2.0 plugin is also removed, so no modified-file source obligation applies.

## Required before any distribution

1. Build and run option C on a physical Android phone and an iOS device. Neither has been done.
2. Confirm the iOS build links no `com.facebook`/`FBSDK` symbols (`nm` or the linker map).
3. Read the Android Software Development Kit License terms for the Google libraries.
