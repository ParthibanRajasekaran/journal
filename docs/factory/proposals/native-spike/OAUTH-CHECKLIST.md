# Google OAuth setup for the native spike (owner steps)

Identifiers below are derived from this repository, not invented. Nothing secret is listed. You create the clients,
and you handle consent and any credential. The agent has not created, changed or read any Google setting.

## Values derived from the project

| Item | Value | Where it comes from |
|---|---|---|
| Android application ID | `com.journal.nutrition` | `web/android/app/build.gradle`, `applicationId` |
| iOS bundle identifier | `com.journal.nutrition` | `web/ios/App/App.xcodeproj`, `PRODUCT_BUNDLE_IDENTIFIER` |
| Android debug signing SHA-1 | `9B:63:12:33:3A:6D:BC:09:83:F9:2E:B8:DB:39:F4:6E:0A:A0:F3:46` | `keytool -list -v` on `~/.android/debug.keystore`, alias `androiddebugkey`. A public certificate fingerprint. |
| Android release signing SHA-1 | not yet available | Needed only for a release build. Obtain it from the release keystore when one exists. |
| Web application client | the existing production web client already used by the backend as `JOURNAL_GOOGLE_CLIENT_ID` | Copy its ID from your own secret store. It is not printed here, and it is not a secret. |

## Steps

1. **Web application client (existing).** Do not create a new one. Use the existing client. Confirm in Google Cloud
   that it is of type "Web application". It is the audience of every ID token this app accepts.
2. **Android client (new).** Create an OAuth client of type **Android**. Package name `com.journal.nutrition`. SHA-1
   `9B:63:12:33:3A:6D:BC:09:83:F9:2E:B8:DB:39:F4:6E:0A:A0:F3:46` (debug). Do not pass this client's ID to the app.
   Create a second Android client later for the release SHA-1.
3. **iOS client (new).** Create an OAuth client of type **iOS**. Bundle ID `com.journal.nutrition`. Note two values
   it shows: the client ID, and the **reversed client ID** (the same ID with its dot-separated parts reversed).
4. **Consent screen.** Set it to Testing. Add each Google account that will sign in as a test user.
5. **Give the agent these two values only, for the build:**
   - `VITE_GOOGLE_WEB_CLIENT_ID`: the web client ID.
   - `VITE_GOOGLE_IOS_CLIENT_ID`: the iOS client ID.
   Set them in your shell or CI environment for the build. Do not commit them to a file. Public client IDs are not
   secrets, but keeping them out of the repository keeps builds reproducible without hardcoding a developer setting.
6. **iOS URL scheme (owner-supplied).** Add the reversed client ID as a URL scheme in
   `web/ios/App/App/Info.plist`, under `CFBundleURLTypes` / `CFBundleURLSchemes`. This is a value only you have, and
   the agent will add it when you supply it.

## Never put in evidence, logs or the repository

- Any client secret, refresh token, ID token, access token or account email.
- Screenshots or logs that show an account email. Redact before sharing.

## What the spike needs from you, in order

1. Steps 1 to 4 above.
2. Step 5 values, for a debug build on the emulator or a phone.
3. Step 6 value, before the iOS build is attempted.
4. Confirm you accept the Facebook SDK question in `LICENSES.md` before any iOS build leaves this machine.
