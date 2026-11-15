# Android: build, install and provenance

Status: personal test build, debug-signed. Not a store release. The beta backend it targets is a proposal that has not been
activated (`docs/release/beta-backend.md`), and the real Google sign-in has not been run on any device. Nothing in the
provenance table below has been installed on a phone.

## Build

Needs JDK 21 (Capacitor 8), the Android SDK and Node. From the repository root, with `JAVA_HOME` pointing at JDK 21
(on macOS Homebrew: `/opt/homebrew/opt/openjdk@21`):

| Target | Command | API base | Notes |
|---|---|---|---|
| Phone, beta backend | `VITE_GOOGLE_WEB_CLIENT_ID=<web client id> web/scripts/build-android.sh beta` | `https://beta.journal.getrendercheck.com` (override with `JOURNAL_BETA_API_BASE`, must be `https://`) | Cleartext is refused. `vite build --mode beta` fails unless the base is HTTPS. |
| Emulator, local backend | `web/scripts/build-android.sh emulator` | `http://10.0.2.2:8000` (override with `JOURNAL_EMULATOR_API_BASE`) | Allows plain HTTP to the host loopback. Never a release. |

The script sets `VITE_API_BASE` and `VITE_BUILD_SHA` (the git SHA, with `-dirty` appended if the tree has uncommitted
changes), runs `vite build`, `cap sync android` and `gradlew assembleDebug`, then prints the APK path, its SHA-256 and the
source SHA. Without a web client id the sign-in button says Google sign-in is not set up in this build
(`docs/release/google-oauth.md`).

A `-dirty` source SHA does not identify a reproducible build. Commit first for any artifact you record as evidence.

## Install and check

1. `adb install -r web/android/app/build/outputs/apk/debug/app-debug.apk` (USB debugging on, `adb devices` lists the phone).
2. Open Settings in the app. "About this build" shows the app's build SHA and the server's `/version` output. They must
   match the row you are about to add to the table below.
3. Run the manual M0 journey (`docs/milestones.md`): phone on mobile data with the Mac disconnected; Google sign-in;
   create, edit and reopen a meal; cold restart restores the session; sign out; sign in with the disposable second account
   and confirm it sees nothing.

## Provenance table

One row per artifact you install. Fill every column from the script output and `GET /api/v1/version`; leave nothing
inferred.

| Date | Source SHA | APK SHA-256 | API base | Server `/version` | Installed on | Result |
|---|---|---|---|---|---|---|
| 2026-11-15 | `9435ad4ff4788fa0544144112642697fad707856-dirty` | `b8a9e76bbdec7b41ec46da54aaf143f7e06e63d06d47e05b0da18725052d2a7a` | `https://beta.journal.getrendercheck.com` | none: the beta backend is not running | nothing | Built by `build-android.sh beta` to prove the pipeline. Dirty tree, so not reproducible. Not installed. |

The earlier test APK (`journal-beta-debug-4333b32.apk`, built with cleartext for an emulator backend) is superseded and is
not a valid artifact for a phone.

## What is evidenced

- The server side of six user journeys with synthetic accounts and test signing keys (`backend/tests/test_mvp_journeys.py`):
  sign-in, create, edit and reopen a meal, session restore from the refresh token, offline replay without duplicates,
  logout, account switching, and deleted-account refusal. Kind: mocked test.
- `GET /api/v1/version` reports the source SHA, API version and migration head (`backend/tests/test_version.py`). Kind:
  mocked test.
- Release configuration guards: `vite build --mode beta|production` fails without an `https://` API base, production
  settings refuse insecure cookies and a missing JWT secret, and the build script refuses cleartext outside the emulator
  target. Kind: mocked test and a local build.
- An earlier session recorded the debug build reaching a local test backend from the Android emulator and the iOS
  simulator build linking the Google plugin. Those were not re-run for this document; treat them as unverified until the M0
  manual criteria are recorded.

## Not yet demonstrated

- Real Google sign-in. Needs the owner's OAuth clients and a real account. Which `aud` and `azp` Google issues is unproven,
  and the backend verifier may refuse them (Parked in `docs/milestones.md`).
- Every device journey above, over mobile data, with the Mac off.
- A physical iOS device, and any release-signed build.

## Known limitations

- The debug APK is not signed for release. There is no store listing, no push and no crash reporting. Release signing (an
  Android keystore, an Apple team and provisioning) is an owner step.
- The offline outbox is held in browser or WebView storage until M1 moves it to IndexedDB. If the device refuses storage, a
  queued meal cannot be kept, and a deleted account's leftover data can remain until site data is cleared.
- Two tabs sending the same queued meal send duplicate requests; the server stores one meal.
- Logout for a deleted or expired session returns 204 and clears cookies. This is the agreed behaviour.
