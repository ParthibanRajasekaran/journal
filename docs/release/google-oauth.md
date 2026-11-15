# Google OAuth: owner checklist for native sign-in

Status: not done. No OAuth client exists yet, and no real Google ID token has been seen by this code. Everything below
that describes what a real token contains is the expected behaviour, not an observation. The flow is in
`docs/native-sign-in.md`. Client ids are public identifiers; the client secret is held only by the backend and never goes
into the app or the repository.

## Create the clients (Google Cloud console, one project, OAuth consent screen configured)

Do these in order. Keep the consent screen in Testing with your own account and the disposable second account added as
test users, so no verification review is needed.

1. **Web client** (application type: Web application). Its client id is the token audience. Record it as:
   - `VITE_GOOGLE_WEB_CLIENT_ID` at build time (public), and
   - `JOURNAL_GOOGLE_CLIENT_ID` in the backend environment (`docker/beta/.env.beta` for the beta stack).
   Its secret goes only in `JOURNAL_GOOGLE_CLIENT_SECRET` on the server. Add the redirect URI
   `https://beta.journal.getrendercheck.com/api/v1/auth/google/callback` if the browser flow is used against beta.
2. **Android client** (application type: Android).
   - Package name: `com.journal.nutrition` (from `web/android/app/build.gradle`).
   - SHA-1 certificate fingerprint of the key that signs the APK. For the debug build that is the debug keystore:
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
     and copy the `SHA1:` line. A release build signed with another key needs its own Android client with that key's SHA-1.
   - The Android client id is not put in the app. It only has to exist for Google to accept this package and signature.
3. **iOS client** (application type: iOS), bundle id from `web/ios/App`. Record its client id as
   `VITE_GOOGLE_IOS_CLIENT_ID`. Not needed for the Android phone check.

## Build and check

- Android beta build, with the ids set: `VITE_GOOGLE_WEB_CLIENT_ID=<web id> web/scripts/build-android.sh beta`.
  Without the web client id the sign-in button reports that Google sign-in is not set up in this build.
- After the first real sign-in, record the token's `aud` and `azp` (decode the payload locally; never paste the token
  anywhere) in the evidence table of `docs/release/android.md`.

## Known risk to settle with the first real token

The backend (`backend/app/auth/google.py`) accepts one audience, `JOURNAL_GOOGLE_CLIENT_ID`, and refuses a token whose
`azp` is present and different from it. Google normally issues Android ID tokens with the web client id as `aud` and the
Android client id as `azp`, and `docs/native-sign-in.md` says iOS uses the iOS client id as the audience. If a real token
looks like that, the backend will refuse it even though sign-in succeeded on the phone. That would need a change to the
verifier (accept the configured native client ids), which is outside the M0 paths and is recorded under Parked in
`docs/milestones.md`. Until a real token is decoded, this is a suspicion, not a finding.

## Owner actions

- Create the three clients above and add yourself and the disposable second account as test users.
- Give the web client id and secret to the beta `.env.beta`; give the web client id (and iOS client id) to the build.
- Decode the first real token's payload locally and tell me its `aud` and `azp`. The server's refusal ("ID token issued
  to another client") does not log them.
