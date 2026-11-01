# Native sign-in evidence register

Status values: **demonstrated** (run, with the command and result recorded), **partial** (run in a weaker
environment than required), **pending** (not run; the owner action or the prerequisite is listed). Nothing marked
pending is claimed as working.

| Claim | Environment | Status | What would demonstrate it | Blocked on |
|---|---|---|---|---|
| Attempt model: cross-attempt tokens, missing/wrong/expired/consumed, cancel, retry, restored tokens | Python, SQLite, unit tests | demonstrated (model only) | `make native-proposal` | none |
| Consumption and session creation share one transaction, with rollback on failure | Python, SQLite | demonstrated (model only) | `make native-proposal`, incl. the rollback tests | none |
| Concurrent completion yields one consumption and one session | SQLite | partial | 10-thread test | Postgres run pending |
| Same behaviour under PostgreSQL row locking | PostgreSQL | pending | Run the same concurrency test against the Postgres test database, with `SELECT ... FOR UPDATE` or the conditional UPDATE | an implementation is approved; not in the repository |
| Rollback on a killed process between insert and commit | PostgreSQL | pending | Kill the process at the insert, restart, confirm no session and a pending attempt | implementation and Postgres |
| Real Google tokens carry the requested nonce unchanged | Android SDK, real account | pending | Log only a hash of the nonce claim, never the token | OAuth clients and Google sign-in by the owner |
| Audience and authorized-party values for Android tokens | Android emulator, `google_apis_playstore` | pending | Decode claims locally, print only `aud` and `azp` names | OAuth clients |
| Audience and authorized-party values for iOS tokens | iOS simulator | pending | As above | OAuth clients; `ios/` moved under `web/` |
| Credential Manager can return a credential minted before the request | Android emulator | pending | Start a second login and compare `iat` with the attempt time | OAuth clients |
| iOS restored sign-in ignores a missing nonce | iOS device | pending (source read only) | Restore a session, then log in without a nonce and observe | physical iOS device and signing identity |
| Secure session storage, refresh, logout, account switch | Android emulator | pending | Store tokens in secure storage, kill and relaunch, refresh, log out, sign in as a second account and check that no first-account data is reachable | an implementation and OAuth clients |
| Same flow on a physical Android phone | Android device | pending | Repeat the emulator steps on a phone | a phone, and an owner-run session |
| Same flow on iOS simulator | iOS simulator | pending | Repeat the flow | `ios/` move, dependency approval |
| Same flow on a physical iPhone | iOS device | pending | Repeat the flow | an Apple signing identity and provisioning, which do not exist (zero valid identities) |

## Status after the native spike (1 November 2026)

| Claim | Environment | Status | Evidence |
|---|---|---|---|
| Attempt model rules and transaction rollback (SQLite model) | Python | demonstrated | `make native-proposal`: 16 tests |
| Attempt binding, missing/wrong/expired/consumed, cancel, retry, rollback, concurrency on **PostgreSQL** | PostgreSQL 18 test database on 127.0.0.1 | demonstrated (locally signed test tokens) | `backend/tests/test_native_auth.py`: 17 tests, including 12 concurrent consumptions yielding exactly one |
| Rollback of consumption, user and session together, on PostgreSQL | PostgreSQL | demonstrated (simulated failure, not a killed process) | `test_a_failed_session_rolls_back_the_consumption_and_the_user`; a mutation that commits on failure makes it fail |
| Bearer sessions: create and reopen a meal, account isolation, CSRF still required on writes | PostgreSQL + API | demonstrated | `test_bearer_sessions_create_reopen_and_stay_isolated_per_account`, `test_a_bearer_token_does_not_bypass_the_csrf_header_on_writes` |
| Refresh rotation, reuse revokes the family, logout revokes | PostgreSQL + API | demonstrated | `test_refresh_rotates_reuse_revokes_and_logout_ends_the_session`, `test_logout_revokes_the_native_session` |
| Client: nonce passed to the SDK, cancellation cancels the attempt, refused completion stores nothing, restore, single refresh, sign-out clears first | Web unit tests, injected device adapters | demonstrated (logic only, no device) | `web/src/native/auth.test.ts`: 16 tests |
| Client: bearer header used, 401 renews and retries with the new token, logout routes to native | Web unit tests | demonstrated (logic only) | `web/src/api.test.ts` native block |
| Plugin API and types used by the adapter | Pinned package 8.7.5 | demonstrated against published types | `npx tsc --noEmit` passes with the adapter |
| Android app builds with both pinned plugins | Gradle, JDK 21, debug APK | demonstrated | `assembleDebug` succeeds; APK no longer requests `USE_BIOMETRIC` (the plugin's unused permission is removed by an override) |
| Android app launches and reaches sign-in | Emulator `google_apis_playstore` | **pending** | Not run in this checkpoint |
| Real Google ID token: audience, authorised party, nonce echo, expiry | Android emulator with real Google account | **pending owner OAuth clients and consent** | `OAUTH-CHECKLIST.md` |
| Credential Manager behaviour with a restored or cached credential | Android emulator | **pending** | As above |
| iOS app builds for the simulator | Xcode 27.1 via DEVELOPER_DIR | **blocked** | `xcodebuild` stalls while resolving Swift packages (checkout of `keychain-swift` never completes; git clones of the same repository complete). Reproduced three times with a fresh package cache. Needs an Xcode-side check, outside the agent's reach. |
| iOS simulator sign-in and reopen | iOS simulator | **blocked** | Depends on the simulator build and an iOS OAuth client |
| iOS physical device | iPhone | **pending** | No valid code-signing identity exists (zero valid identities) |
| Physical Android phone | Android device | **pending** | No phone attached |
| Secure session storage across relaunch on device | Android emulator / phone | **pending** | Keychain and Keystore behaviour not exercised on a device |
| Account switch without outbox replay, on device | Emulator / phone | **pending** | The rule is covered by web unit tests (`offline.test.ts`), not by a device run |
| Offline capture then reconnect, on device | Emulator / phone | **pending** | Not run |

Nothing marked pending is claimed as working. The attempt design is supported by the server tests above; the real
Google token behaviour is not.

No row is a release claim. Passing a row shows evidence for a design decision, not that the app is approved.

## Transport and device check (1 November 2026)

| Claim | Environment | Status | Evidence |
|---|---|---|---|
| Native HTTP patch needed: a WebView cannot call the API cross-origin | Emulator `google_apis_playstore`, debug APK built with `CapacitorHttp` disabled, production API base compiled in | demonstrated | Screenshot shows "Journal can't be reached"; path `.factory-local/` is not used, screenshot in the verification scratch area |
| Native HTTP patch fixes reachability | Same emulator, debug APK with `CapacitorHttp` enabled | demonstrated | Screenshot shows "Journal server: reachable" (read-only `GET /api/v1/health`) |
| Google sign-in on device | — | pending | Needs your OAuth clients and account |
| Phone (not emulator) run | — | pending | No phone attached |
| iOS | — | pending | Simulator build blocked (Swift package resolution stall); no device |
