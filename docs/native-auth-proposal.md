# Native sign-in for Android and iOS: proposal for review (revision 2)

Status: proposal. Not implemented. The change touches paths the agent policy marks as human-review-only
(`**/auth/**`, `backend/app/routes/auth.py`). Authoritative source for the decisions: ADR-004. Revision 2
replaces revision 1, which used a custom URL scheme. ADR-004 requires a claimed HTTPS link, so that
design is withdrawn.

## Verified facts (read-only, 31 October 2026)

| Check | Result |
|---|---|
| `GET https://journal.getrendercheck.com/api/v1/health` | 200 `{"status":"ok"}` |
| `GET https://journal.getrendercheck.com/api/v1/health/ready` | 200 `{"status":"ready"}` |
| `GET https://journal.getrendercheck.com/api/v1/meals`, no session | 401 |
| `GET https://journal.getrendercheck.com/api/v1/auth/google/start` | 302 to Google, PKCE S256, redirect to the production callback |
| Migration head in this checkout | `f4b8c2a6d1e9` |
| Backend suite on this branch | 249 passed |

The deployed commit is not visible from outside, so whether production runs this code is unverified.

## What blocks the packaged app today

1. The API sends no CORS grant (ADR-004 and `backend/app/auth/deps.py`). The app's origin
   `https://localhost` is cross-site to the API, so `fetch` fails.
2. Session cookies are `SameSite=Lax` (access) and `SameSite=Strict` (refresh). Cross-site requests from
   the app never send them.
3. Loading the hosted app in the WebView would run Google sign-in in the WebView. ADR-004 forbids this,
   and RFC 8252 requires the system browser.

## Decision required: which ADR-004 variant

Both variants meet ADR-004 (system browser, PKCE, claimed HTTPS redirect, no embedded webview). They differ
in who holds the Google code exchange.

### Variant A: native public client (recommended, follows the ADR-004 sequence)

- Google: a second OAuth client of Android and iOS type (or a web client with the app-link redirect URI
  registered). It has no client secret. Its redirect is the claimed HTTPS link
  `https://journal.getrendercheck.com/app/auth/callback`. This is a Google console change owned by a person.
- App: generates PKCE verifier, S256 challenge and nonce. It stores them in secure storage before opening
  the system browser. The browser returns `code` and `state` through the App Link.
- App calls `POST /api/v1/auth/native/callback` with `{code, state, verifier, nonce}`.
- Backend: exchanges the code with Google using the native client ID and the verifier, validates the ID
  token per ADR-004 §2 (JWKS, `iss`, `aud`, `exp`, `nonce`, `email_verified`), upserts the user by `sub`,
  and calls `service.start_session`. It returns `{access_token, refresh_token, expires_in}`. The access
  token is a JWT with `sid`, valid 15 minutes.
- No exchange code is needed, because the tokens travel in the response to the same client over TLS.
- Single-flight refresh, rotation and reuse-revokes-family are unchanged from ADR-004 §3.

### Variant B: backend-mediated (keeps the single existing Google web client)

- Google redirects to the existing backend callback. The backend then redirects the browser to the
  claimed HTTPS link `https://journal.getrendercheck.com/app/auth/return?code=...`.
- The code is a one-time exchange code. The app redeems it at `POST /api/v1/auth/native/token`.
- Atomic consumption (required in this variant):
  1. Store only `sha256(code)`, with `user_id`, the expected `challenge`, `expires_at` (now + 120 s) and
     `used_at` (null).
  2. On redeem, first burn the code in one statement:
     `UPDATE native_exchange_codes SET used_at = now() WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id, challenge`.
     Postgres row locking makes this a single winner. Zero rows returns 401.
  3. Compare `S256(verifier)` with the returned `challenge`. A mismatch returns 401 and the code stays
     burned. A leaked code cannot be retried.
  4. Only then call `service.start_session` and commit. Both happen in one transaction.
- Test: 20 concurrent redeems of one code produce exactly one 200 and 19 failures.
- Migration: `native_exchange_codes(code_hash primary key, user_id, challenge, expires_at, used_at)`.
- This variant keeps the web flow unchanged. It is less direct than A, because the backend handles the
  code exchange with Google's client secret, and the native app depends on the backend's redirect.

Recommendation: variant A. It matches ADR-004's sequence exactly, avoids a second credential path, and
needs no exchange-code table. Variant B is the fallback if a second Google client is unwanted.

## Backend changes (both variants)

- `current_user_id` accepts `Authorization: Bearer <access>` when the access cookie is absent. Writes still
  require `X-Journal-Request: 1`. The CSRF rule stands, since a bearer token is not sent ambiently.
- `POST /api/v1/auth/native/refresh` `{refresh_token}` calls `service.rotate`, and returns a new pair.
- `POST /api/v1/auth/native/logout` `{refresh_token}` calls `service.revoke`.
- Sign-out everywhere (ADR-004 §4) is a separate endpoint, not part of this change.

## Client changes

- `@capacitor/browser` opens the system browser (Custom Tabs on Android, ASWebAuthenticationSession on iOS).
- `@capacitor/app` receives the App Link through `appUrlOpen`.
- Android: an intent filter with `android:autoVerify="true"` for the host, and
  `/.well-known/assetlinks.json` served from production with the signing certificate fingerprint. The debug
  APK signing fingerprint is a different value, so App Links verify only for the matching key.
- iOS: an associated domain and `/.well-known/apple-app-site-association`. This needs a signed build.
- Caddy must serve both `/.well-known/` files. That is an ops change to `docker/Caddyfile`, not made here.

## Secure storage: chosen plugin and its limits

Choice: `@aparajita/capacitor-secure-storage` version 8.0.1, the Capacitor 8 release (peer `node >=20`).
It stores data in the iOS keychain and, on Android, encrypts with AES-GCM under an Android Keystore key,
then writes to app-private SharedPreferences. Both platforms are documented by the package.

Limits, to be stated to the owner:

- This is OS-protected storage. It is not biometric-bound. ADR-004 §5 (non-exportable keys, biometric
  prompt on each unlock, Secure Enclave or StrongBox) is not met by this plugin alone. It is a separate,
  later step.
- Keys are not hardware-attested by this plugin. Accept that, or name a Keystore plugin instead.
- iOS keychain data survives app deletion. Android data does not.

## Permissions

`USE_BIOMETRIC` is unused. Remove it in the native change. Do not claim biometric unlock until the
ADR-004 §5 work exists.

## Required decisions

1. Choose variant A or B.
2. For variant A, create the native Google OAuth client and register the App Link redirect (owner action).
3. Approve the backend change, or name a person to make it.
4. Confirm production runs this code.
5. Approve the storage plugin, or name a different one, knowing the limits above.
6. Decide the repository policy for `web/`, `android/`, `ios/` and `factory/`. See
   `docs/factory/policy-reconciliation.md`.

## Verification plan (once approved)

- Backend tests: code reuse, expired code, wrong verifier (variant B), concurrent redeem (variant B),
  refresh reuse revoking the family, logout revoking the family, a bearer request with no cookie, and a
  bearer write with no CSRF header.
- Android emulator: install the debug APK, start sign-in, confirm the browser opens and the App Link
  returns to the app (verify the App Link on the emulator with `adb shell pm get-app-links`), confirm the
  session survives force-stop and relaunch, and confirm sign-out.
- Physical Android device: the same steps. Emulator results are reported separately.
- iOS: simulator run after the `ios/` relocation, then a signed device build.
- Google sign-in needs a person with their own account. It cannot be automated, and the agent does not
  enter credentials.
