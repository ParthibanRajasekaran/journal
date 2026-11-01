# Google OAuth checklist for native sign-in (owner steps)

Status: prepared, not performed. The agent has not created, changed or read any Google Cloud setting, and has not
signed in with any Google account. Identifiers below are either derived from this repository or are public
client identifiers. No secret, token or account email appears in this document.

Scope: Google sign-in only, through the in-repo plugin `@journal/google-auth` (GoogleSignIn-iOS 9.2.0 and Android
Credential Manager). Facebook is absent from the build, so no Facebook decision is needed.

## 1. Values that come from the repository

| Item | Value | Source |
|---|---|---|
| Android application ID | `com.journal.nutrition` | `web/android/app/build.gradle`, `applicationId` |
| iOS bundle identifier | `com.journal.nutrition` | `web/ios/App/App.xcodeproj/project.pbxproj`, `PRODUCT_BUNDLE_IDENTIFIER` |
| Android debug signing SHA-1 | `9B:63:12:33:3A:6D:BC:09:83:F9:2E:B8:DB:39:F4:6E:0A:A0:F3:46` | `keytool -list -v` on `~/.android/debug.keystore`, alias `androiddebugkey`. A public certificate fingerprint, used for debug builds only. |
| Android release SHA-1 | not available | Needed only for a release build. Take it from the release keystore when one exists. Register it as a second Android client. |

## 2. Google Cloud steps (owner)

1. **Web application client (existing, do not create a new one).** Confirm in Google Cloud that the existing
   production client is of type "Web application". Its ID is the audience of every ID token the backend accepts.
2. **Android client (new).** Type **Android**. Package name `com.journal.nutrition`. SHA-1: the debug value above.
   Do not give this client's ID to the app. Its ID is never used in the code.
3. **iOS client (new).** Type **iOS**. Bundle ID `com.journal.nutrition`. Note two values Google shows:
   the **client ID** and the **reversed client ID** (the same ID with its dot-separated parts in reverse order).
4. **Consent screen.** Set the publishing status to **Testing**. Add each Google account that will sign in under
   "Test users". Record the accounts in your own notes, not in this repository.

## 3. Values the owner supplies to the build (never committed)

| Name | Holds | Read by | How to supply |
|---|---|---|---|
| `VITE_GOOGLE_WEB_CLIENT_ID` | the web client ID | `web/src/native/platform.ts` (sent as the server client ID) | Shell or CI environment variable at build time |
| `VITE_GOOGLE_IOS_CLIENT_ID` | the iOS client ID | `web/src/native/platform.ts` (iOS only) | Shell or CI environment variable at build time |
| `JOURNAL_GOOGLE_CLIENT_ID` | the web client ID (same value) | `backend/app/config.py`, which reads the `JOURNAL_` prefix from the environment or `backend/.env` | Backend environment only |

Rules:

- The backend needs the **client ID only** for native sign-in. Do not add `JOURNAL_GOOGLE_CLIENT_SECRET` for this
  work, and never pass a client secret to the app or the build. The native path does not use it.
- Do not write any of these values to a tracked file. Keep them in your shell, CI secrets or an untracked env file.
- If a value is missing, the app does not start a sign-in. It shows "VITE_GOOGLE_WEB_CLIENT_ID is not set for this
  build", or the iPhone equivalent, which names the variable and never its value (`web/src/native/google.ts`).

## 4. iOS URL scheme (owner-supplied value)

`web/ios/App/App/Info.plist` currently has **no** `CFBundleURLTypes` entry. Add the reversed iOS client ID as one
URL scheme so GoogleSignIn can return to the app:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string><reversed iOS client ID></string>
    </array>
  </dict>
</array>
```

The agent will add this entry only when you supply the reversed client ID. Until then the iOS sign-in cannot return
to the app. `SceneDelegate.swift` already passes incoming URLs to `GIDSignIn`.

## 5. Checks before the first sign-in attempt

- [ ] Web client is type "Web application" and is the same ID as `JOURNAL_GOOGLE_CLIENT_ID` on the backend.
- [ ] Android client exists with package `com.journal.nutrition` and the debug SHA-1 above.
- [ ] iOS client exists with bundle `com.journal.nutrition`, and the reversed client ID is in `Info.plist`.
- [ ] Consent screen is in Testing and each test account is listed.
- [ ] `VITE_GOOGLE_WEB_CLIENT_ID` is set for the build. `VITE_GOOGLE_IOS_CLIENT_ID` is set for any iPhone build.
- [ ] No client secret is in the app, the build environment for the app, or any tracked file.

## 6. Never put in evidence, logs, screenshots or the repository

- Any client secret, ID token, access token, refresh token, or the `attempt_secret`.
- Any Google account email. Redact it from screenshots and logs before sharing. Use a role, such as "test account A".
- Full values of the build variables, when you paste a command. Replace them with `<set>`.

## 7. What is still needed from you, in order

1. Steps 2 to 4 in Google Cloud.
2. Section 3 values for an Android debug build, then run the guided sign-in test in
   `GUIDED-SIGN-IN-TEST.md`.
3. Section 4 value (the reversed iOS client ID) before an iPhone build can complete a sign-in.
4. The release SHA-1, only when a release build is planned.
