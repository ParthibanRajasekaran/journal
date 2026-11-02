# Android beta: setup and known limitations

Status: personal MVP, test build. Not for release. Not deployed. Production is not used by this build by default.

## Artifacts

- APK: `journal-beta-debug-4333b32.apk`, debug build, built from the web/android tree of commit `e6cfd90`.
  SHA-256: `98816df1d7be8a55fb7f323913f821c2d1dd3abe612f0d37d65d01b426129a1a`.
  Built with `VITE_API_BASE=http://10.0.2.2:8080` and `JOURNAL_ANDROID_TEST_CLEARTEXT=1`, so it talks to a local test
  backend over plain HTTP on the emulator's loopback. A release build must not set either.
- Integration branch: `mvp/android`, head `156df3c` (the synthetic journey suite and the review branch).

## Isolated test backend (local only)

- Runs on 127.0.0.1:8080 on the developer machine. It is not reachable from other machines and costs nothing.
- Database: a dedicated local PostgreSQL database, `journal_beta_local`, used by no other process.
- Secrets: a random JWT signing secret generated for this test, kept in a file outside the repository. Never commit it.
- Start: export the environment (see `JOURNAL_*` settings in `backend/app/config.py`), run `alembic upgrade head`, then
  `uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8080`.

## Steps

1. Start the test backend as above, and confirm `GET http://127.0.0.1:8080/api/v1/health` returns 200.
2. Build the web client for the emulator: `cd web && VITE_API_BASE=http://10.0.2.2:8080 npx vite build`.
3. Sync the Android project with cleartext for this test build only:
   `JOURNAL_ANDROID_TEST_CLEARTEXT=1 npx cap sync android`, then `cd android && ./gradlew :app:assembleDebug`.
4. Install on the emulator: `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
5. Open the app. The sign-in screen shows "Journal server: reachable" when the backend is up.
6. Google sign-in appears only when `VITE_GOOGLE_WEB_CLIENT_ID` (and, for iOS, `VITE_GOOGLE_IOS_CLIENT_ID`) are set at
   build time. Until the owner's OAuth clients exist, the button shows "not set up in this build".

## Demonstrated

- The app reaches the isolated test backend from the emulator (sign-in screen: "Journal server: reachable").
- The server side of six user journeys, with synthetic accounts and test signing keys
  (`backend/tests/test_mvp_journeys.py`): sign-in, create/edit/reopen a meal, session restoration from the refresh token,
  offline replay without duplicates, logout, account switching, and deleted-account refusal with a clean re-registration.
- The iOS simulator build compiles and links the Google plugin (no physical device, no signing).

## Not yet demonstrated (device journeys)

- Real Google sign-in: needs the owner's OAuth clients and a real account.
- Create, edit and reopen, offline capture and reconnect, logout and switching, deletion on the device.

## Known limitations

- Real Google tokens have not been inspected. The `aud`/`azp` claims and nonce behaviour on Android and iOS are unproven.
- Logout for a deleted or expired session returns 204 and clears cookies. This is the agreed behaviour, but it is a change
  that the owner accepts (see the auth-fix review).
- A deleted account's token outside the browser is refused by a foreign-key path on main, and by the new account check on
  this branch. The check is on the shared authentication dependency.
- The outbox is held in browser or WebView storage. If the device refuses storage, a queued meal cannot be kept, and a
  deleted account's leftover data can remain until site data is cleared. A reload also loses an in-memory warning.
- Two tabs deleting accounts at the same instant can overwrite each other's owed-deletion list. Two tabs sending the same
  queued meal send duplicate requests; the server stores one meal.
- Digest and attribute limits, for the factory's OpenAPI exception, do not apply to the app.
- The debug APK is not signed for release. There is no store listing, no push, and no crash reporting.
- Physical-device signing (Android release keystore, Apple team and provisioning) is an owner step.
