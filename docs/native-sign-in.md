# Native sign-in: the contract the code follows

Status: implemented on the server and in the client; proven with locally signed test tokens only. Real Google tokens on a
physical device are pending the owner's OAuth clients (milestone M0, `docs/milestones.md`).

Code: `backend/app/routes/native_auth.py`, `backend/app/native_attempts.py`, `web/src/native/auth.ts`,
`web/src/native/google.ts`, `web/src/native/platform.ts`, the in-repo plugin `web/plugins/journal-google-auth`.
Tests: `backend/tests/test_native_auth.py`, `backend/tests/test_mvp_journeys.py`, `web/src/native/*.test.ts`.

## Flow

1. **Attempt.** The app calls `POST /api/v1/auth/native/attempts`. The server stores `sha256(attempt_secret)` and a fresh
   `nonce` with a five-minute expiry (`ATTEMPT_TTL_SECONDS`) and returns both. The secret never appears in logs.
2. **Google.** The app asks the platform Google SDK for an ID token bound to that `nonce` (web client id as audience on
   Android; iOS client id on iOS). The plugin exposes one method, `login({nonce, webClientId, iosClientId?})`.
3. **Complete.** `POST /api/v1/auth/native/complete` with `attempt_secret`, `id_token` and `adult`. In one transaction the
   server consumes the attempt (pending to consumed; a reused or expired attempt is refused), verifies the token with the
   existing Google verifier, checks the token `nonce` equals the stored one, creates or loads the user, records adult
   confirmation, and issues an access token plus an opaque refresh token (stored hashed, in a token family).
4. **Refresh and logout.** `POST /auth/native/refresh` rotates the refresh token (reuse revokes the family).
   `POST /auth/native/logout` revokes the family and returns 204 even for an expired or deleted session.
5. **Bearer path.** Native requests send `Authorization: Bearer <access_token>`; a stale browser cookie never blocks a
   valid bearer token. A deleted or soft-deleted account gets a clean 401.

## Client rules (`web/src/native/auth.ts`)

- Every sign-in and sign-out advances a generation counter. A refresh or sign-in that started earlier and finishes later
  must not store tokens or touch device state; tokens it obtained are revoked on the server.
- All secure-storage writes go through one queue and re-check the generation when they run.
- The refresh token lives in platform secure storage under `journal.refresh` with `whenUnlockedThisDeviceOnly`.
  This is secure storage, not biometric unlock. Biometric unlock is not implemented.
- Network failure during restore keeps the stored token and reports "not restored"; it does not sign the user out.
- Client ids are public identifiers set at build time (`VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_GOOGLE_IOS_CLIENT_ID`).
  No client secret is bundled.

## What is and is not verified

| Claim | Evidence |
|---|---|
| Nonce binding, single-use attempts, transaction, bearer path | `backend/tests/test_native_auth.py` (test-signed tokens) |
| Create, edit, reopen, restore, offline replay, logout, account switch, deleted-account refusal | `backend/tests/test_mvp_journeys.py` (synthetic accounts) |
| Stale-operation and storage-queue rules | `web/src/native/auth.test.ts`, `race.test.ts` |
| Real Google token `aud`/`azp`/nonce behaviour on Android and iOS | Not yet; needs the owner's OAuth clients and a device |
| Session restore after a cold restart on a phone | Not yet; M0 manual exit criterion |
