# Native sign-in attempt contract (proposal)

Status: proposal. Not implemented in the application and not approved. The reference model is
`attempt_store.py` and its 11 tests run without the application. Each claim below is marked
**proven** (shown by a test here, or by a source read) or **unproven** (needs the spike with real Google
tokens and a real device).

## Why an attempt exists

Google's token carries the nonce we sent. That is not proof of which login the token belongs to: a token can be
copied, restored from an earlier sign-in, or presented to the wrong attempt. So the backend does not look an
attempt up by the nonce inside a token. It looks the attempt up by a secret that only the initiating client
holds, and the secret never goes to Google.

## Contracts

### `POST /api/v1/auth/native/attempts`

Request: no body. Header `X-Journal-Request: 1` (CSRF rule, as for every write).

Response `201`:

```json
{ "attempt_secret": "<43 chars, base64url>", "nonce": "<43 chars, base64url>", "expires_in": 300 }
```

- `attempt_secret` is kept only in secure storage, in memory during the login, and is sent only to
  `/complete` and `/cancel`. It is never sent to Google.
- `nonce` is passed to the Google SDK as `GoogleLoginOptions.nonce`. The server stores `sha256(nonce)`.
- The server stores `sha256(attempt_secret)`, `sha256(nonce)`, `expires_at = now + 300 s`, and `state = pending`.
- Expiry: 300 seconds. **Proven** in the model (`test_an_expired_attempt_is_refused`).

### `POST /api/v1/auth/native/attempts/complete`

Request body: `{ "attempt_secret": "...", "id_token": "..." }`. The body names no account. Any account field is
ignored, and the response is the same whatever it contains.

Order of checks (**proven** in the model except where noted):

1. Find the row by `sha256(attempt_secret)`. Missing: `401`. (`test_incorrect_attempt_secret_is_refused`)
2. `state` must be `pending`. Otherwise `401` with a generic message. (`test_a_consumed_attempt...`,
   `test_a_cancelled_attempt...`)
3. `expires_at` must be after now. Otherwise `401`. (`test_an_expired_attempt...`)
4. Verify the ID token with Google's keys: signature, `iss`, `aud` (= the web client ID), `azp` if present,
   `exp`, `email_verified`. **Unproven**: the exact `aud`/`azp` values on tokens from the Android and iOS SDKs.
   The spike decides them.
5. The token's `nonce` claim must be present and equal to this attempt's nonce, compared by hash. Missing,
   or not equal: `401`, and the attempt stays pending so the same login can still complete. (`test_missing_nonce...`,
   `test_a_token_from_attempt_a...`, `test_a_restored_token...`)
6. Consume the attempt with one statement, `UPDATE ... SET state = 'consumed' WHERE attempt_hash = $1 AND state = 'pending' AND expires_at > now`.
   Exactly one concurrent caller succeeds. Others get `401`. (`test_concurrent_completions...`, SQLite only)
7. Upsert the user by `sub`, apply the adult-confirmation rule, start a session, and return
   `200 {access_token, refresh_token, expires_in}`.

Verification comes before consumption. A wrong token does not burn the attempt, so a legitimate login is not
lost to a stray or copied token. (The consequence is that a token can be checked many times before the attempt is
used, which is acceptable because only a valid token for this nonce can complete it.)

### `POST /api/v1/auth/native/attempts/cancel`

Request body: `{ "attempt_secret": "..." }`. Idempotent. Cancelling a completed attempt changes nothing.
(`test_cancel_after_completion_changes_nothing`)

## Client handling

1. Call `attempts`. Store `attempt_secret` in secure storage with the login state. Keep the nonce in memory.
2. Call the SDK login with `nonce`. Always pass the nonce. A restored iOS sign-in without a nonce is not used.
3. On success, call `complete` with the returned `id_token` and the stored `attempt_secret`.
4. On cancellation (the user closes the chooser) or any error: call `cancel`, then discard the secret.
5. Retry: start a new attempt. Never reuse a secret or a nonce.
6. A restored sign-in on app start is never completed without a new attempt. The client does not treat a
   stored ID token as a login.
7. After a successful sign-in, the session belongs to that account. The client's per-account outbox and
   drafts are not replayed under another account (existing R1/R2 rules).

## Concurrency and failure

- Two tabs or two requests completing the same attempt: one succeeds (**proven** for SQLite; **unproven** for
  Postgres until the backend test runs against it).
- A network failure after the server consumed the attempt: the client has no session. It starts a new attempt.
  The consumed attempt cannot be used again.
- A backend error before consumption: the attempt stays pending until it expires, and the client may retry
  with the same token within the window, or start a new attempt.

## What is not proven

- Real Google tokens carry the nonce as sent, and the SDKs return it unchanged. **Unproven** on both platforms.
- The `aud` and `azp` values for Android Credential Manager and iOS tokens. **Unproven**.
- Whether the Android Credential Manager path can return a credential minted before this request, and whether
  it honours the nonce in that case. **Unproven**. The backend check rejects such a token either way, but the
  client behaviour is unknown until the spike shows it.
- iOS restored sign-in with a nonce always signs in, as the plugin source states. **Proven from source read;
  unproven on a device.**
- Postgres row-locking behaviour for the consume statement. **Unproven** in this repository.
