# Native sign-in for Android and iOS: proposal for review

Status: proposal. Not implemented. It changes paths the repository's agent policy marks as
human-review-only (`**/auth/**`, `backend/app/routes/auth.py`), so it needs a human owner to make or
approve the change. Prepared 31 October 2026 on `factory/bootstrap`, which is a review branch.

## Verified facts (read-only, 31 October 2026)

| Check | Result |
|---|---|
| `GET https://journal.getrendercheck.com/api/v1/health` | 200 `{"status":"ok"}` |
| `GET https://journal.getrendercheck.com/api/v1/health/ready` | 200 `{"status":"ready"}` |
| `GET https://journal.getrendercheck.com/api/v1/meals` with no session | 401, so auth is enforced |
| `GET https://journal.getrendercheck.com/api/v1/auth/google/start` | 302 to Google, with a PKCE S256 challenge and redirect back to the production callback |
| Migration head in this checkout | `f4b8c2a6d1e9` (adult confirmed) |
| Backend suite on this branch | 249 passed |

The production deployment definition is `docker/compose.yaml` and `docker/Caddyfile`. The deployed
commit is not visible from outside, so it is unverified whether production runs this branch's code.

## Why the current design cannot be used by the app

1. The API sends no CORS grant (`backend/app/auth/deps.py`, ADR-004). A packaged app's origin
   (`https://localhost`) is cross-site to the API, so a cross-origin `fetch` fails.
2. Session cookies are `SameSite=Lax` (access) and `SameSite=Strict` (refresh). A cross-site request
   from the app never sends them.
3. Loading the hosted app inside the WebView would run Google sign-in inside the WebView. That is not
   allowed (see the sign-in requirement).

## Proposed design

Google stays the only identity provider. The Google redirect URI does not change. Sign-in runs in the
system browser (Chrome Custom Tabs). The app receives a one-time code by deep link, then exchanges it
with a PKCE verifier for bearer tokens.

Backend (human review required):

- `GET /api/v1/auth/google/start`: accept an optional `native_challenge` (base64url, S256 of the app's
  verifier). When present, store it in the signed state token. The state cookie is still set, and it
  works in the Custom Tab because the Custom Tab shares the browser cookie jar.
- `GET /api/v1/auth/google/callback`: when the state token carries a native challenge, do not set
  session cookies. Create a single-use exchange code (random, stored as a hash with user id, challenge,
  and a two-minute expiry). Redirect to `com.journal.nutrition://auth?code=...`.
- `POST /api/v1/auth/native/token` `{code, verifier}`: check the code is unused and unexpired, check
  `S256(verifier) == challenge`, mark the code used, call `service.start_session`, and return
  `{access_token, refresh_token, expires_in}`.
- `POST /api/v1/auth/native/refresh` `{refresh_token}`: call `service.rotate`. Reuse of a rotated token
  already revokes the family (ADR-004).
- `POST /api/v1/auth/native/logout` `{refresh_token}`: call `service.revoke`.
- `current_user_id`: accept `Authorization: Bearer <access>` when the access cookie is absent. Writes
  still require the CSRF header.
- Migration: a `native_exchange_codes` table (`code_hash`, `user_id`, `challenge`, `expires_at`,
  `used_at`).

Client (`web/`, plus the Android shell):

- `@capacitor/browser` opens the start URL. `@capacitor/app` listens for `appUrlOpen` on the scheme.
- An intent filter for `com.journal.nutrition` in `AndroidManifest.xml`. `launchMode` is already
  `singleTask`.
- Tokens go in platform secure storage. This needs a maintained plugin or a small native Keystore
  plugin, chosen by the owner. `@capacitor/preferences` is not secure storage.
- The verifier is stored in secure storage before the browser opens, because the app process may be
  killed while the browser is open.
- Sign-out calls `native/logout` and clears storage.
- `VITE_API_BASE` is set at build time to the production origin. It is not a secret and it is not a
  developer address. No secret is bundled.

Biometric unlock is not part of this proposal. `USE_BIOMETRIC` is in the manifest, but nothing uses
it, so it should be removed. Removing it is an `android/` change, which is outside the agent-writable
roots.

## Required decisions

1. Approve the backend change, which touches human-review-only paths, or name a human who will make it.
2. Choose the secure-storage approach: a maintained plugin, or a small Keystore plugin.
3. Confirm the production deployment runs this code, before the app is pointed at it.
4. Decide the repository policy for `web/`, `android/`, `ios/` and `factory/`. The agent change policy
   allows agent writes only under `src/`, `backend/`, `tests/` and `docs/`. Recent work in `web/`,
   `android/`, `factory/`, `Makefile` and `.gitignore` is outside those roots. It is on a review branch
   for human review and has not been merged.

## Verification plan (once approved)

- Backend: tests for each endpoint. Cover code reuse, expired code, wrong verifier, a native start with
  no state cookie, refresh reuse revoking the family, logout revoking the family, and a Bearer request
  with a cookie-less session.
- Android emulator: install the debug APK, start sign-in, confirm the browser opens and the return
  deep link is captured, confirm the session survives a force-stop and relaunch, and confirm sign-out.
- Physical device: the same steps on a real Android phone. Emulator results are not a substitute.
- Google sign-in needs a human to sign in with their own account. It cannot be automated here, and no
  credentials will be entered by the agent.
