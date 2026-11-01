# Guided sign-in test (owner runs it on a device or emulator)

Status: plan only. Nothing here has been run. The agent does not enter Google credentials, and nothing below
records a result. Each run is reported separately as **emulator**, **simulator** or **physical device**. A pass
on one is not a pass on another.

Prerequisites: the OAuth steps in `OAUTH-CHECKLIST.md` are done, the build variables are set, and the backend is
reachable. For Android, use `Medium_Phone_API_36.0` (`google_apis_playstore`). For iOS, use a signed build on a
device, because the simulator cannot be relied on for the Google account chooser.

## Rules for every step

- Use only the test accounts you listed on the consent screen. Use two accounts for the switching test (A and B).
- Do not copy tokens, `attempt_secret`s, cookies or account emails into notes or screenshots. Redact them.
- Record the platform, build SHA, OS version and device or emulator name at the top of each run.
- If a step fails, stop that step, note the exact on-screen text, and continue with the next independent step.

## Evidence to capture

| Evidence | How | Redaction |
|---|---|---|
| Screen state at each step | screenshot | blur any email or name |
| Server reachability | the "Journal server: reachable/unreachable" line on the sign-in screen | none needed |
| Logcat (Android) or console (iOS) for the step | filtered to `JournalGoogleAuth` and the app's tag only | remove any token-like string before sharing |
| Result code shown | exact text, such as "Sign-in didn't finish. Please try again." | none needed |

Do not capture full network traces. They contain tokens.

## Scenarios

### 1. Login

1. Launch the app signed out. Expected: the sign-in screen shows the native "Continue with Google" button, and no
   browser redirect is shown.
2. Tap "Continue with Google". Choose test account A.
3. Expected: the app shows the Today screen signed in as account A. The sign-in screen does not show again.
4. Expected in the backend: one session is created for the attempt. Completion is refused for a reused attempt.

### 2. Relaunch

1. With account A signed in, close the app fully (swipe away on the device, or kill it on the emulator).
2. Reopen. Expected: the app restores the session without a new Google prompt, and shows account A's Today screen.
3. Expected: the restore does not complete an old sign-in. A stored ID token is never treated as a login.

### 3. Refresh

1. Keep account A signed in. Wait until the access token has expired (15 minutes, per ADR-004), or use a build
   that shortens the window for this test only.
2. Make any action that calls the API, such as loading Today. Expected: the app refreshes silently and the action
   succeeds.
3. Expected: the refresh token rotates. Replaying the previous refresh token is refused (family revocation).
   Check this with a single controlled replay, if a test build exposes it.

### 4. Logout

1. Tap sign out. Expected: the app returns to the sign-in screen.
2. Relaunch. Expected: no session is restored.
3. Expected: the stored refresh token is removed from secure storage. Verify by the absence of the session on
   relaunch, not by reading the storage.

### 5. Account switching

1. Sign in as account A. Add a meal and leave it unsent while offline (see scenario 6), or confirm the outbox is
   empty.
2. Sign out, then sign in as account B.
3. Expected: account B sees only its own data. Account A's queued items are not sent or shown under account B.
4. Expected: if account A's outbox has unsent items, the app quarantines or keeps them for account A, and does not
   replay them under account B.
5. Expected with an old tab or stale session: a stale refresh or sign-in result does not overwrite the current
   account's tokens. This is covered by `web/src/native/race.test.ts`; the device run only confirms the visible
   behaviour.

### 6. Offline recovery

1. Sign in as account A. Turn on airplane mode.
2. Expected: the sign-in screen or Today shows the server as unreachable. Add a meal. Expected: it is queued, and
   the app says it will send when the connection returns.
3. Turn airplane mode off. Expected: the queued meal is sent once, and it appears once in the backend.
4. Expected: no duplicate meal after repeated reconnects.
5. Optional: start a sign-in while offline. Expected: a clear failure (`UNAVAILABLE`), with no session created and
   no stored token.

### 7. Cancellation and configuration (quick checks)

1. Start sign-in and close the account chooser without choosing. Expected: the app shows the signed-out state, with
   no error banner. The result code is `USER_CANCELLED`.
2. On a build with a missing client ID, the sign-in button does not start a sign-in. Expected: the message names the
   missing variable and shows no value.

## Result template (copy for each run)

```
Run: <scenario number and name>
Platform: <emulator | simulator | physical device>, <device name>, <OS version>
Build SHA: <committed SHA>
Account: <test account A or B, no email>
Result: <pass | fail | not run>
Observed text: <exact text>
Evidence file(s): <path>, redacted: <yes/no>
Notes: <what differed from expected>
```

## What this plan does not establish

- It does not verify Google's token contents. A pass means the app behaved as expected on that build and device.
- It does not prove release-signing behaviour. That needs the release SHA-1 and a release build.
- It does not prove the iPhone path. The iPhone result is reported only after a signed device run.
