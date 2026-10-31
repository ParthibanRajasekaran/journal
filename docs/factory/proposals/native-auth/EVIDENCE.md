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

No row is a release claim. Passing a row shows evidence for a design decision, not that the app is approved.
