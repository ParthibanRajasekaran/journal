# ADR-004: Authentication with Google OAuth 2.0 and biometric unlock

**Status:** Proposed, 2026-10-29. Owner: Security. Related: PRD FR-1, FR-2, FR-3, FR-9.

## Context

Google sign-in is the only MVP sign-in method, and the first sign-in creates the account. Users may then enable biometric unlock. It must not replace Google sign-in on a new device, must not use a PIN, and must not leave a long-lived secret in plain storage.

Standards checked 2026-10-29 (see Sources): RFC 9700 requires PKCE for public clients and sender-constrained or rotated refresh tokens. RFC 8252 requires the system browser for native apps. Google disallows embedded webviews and requires full ID token validation.

## Decision

**1. Flow.** Google is the only OIDC provider. All clients use the authorization code flow with PKCE (S256), scopes `openid email profile`. We request no offline access and never store a Google refresh token.

- **Web:** the FastAPI backend is the confidential client and holds the client secret. Tokens never reach browser JavaScript. The session is an `HttpOnly; Secure; SameSite=Lax` `__Host-` cookie.
- **Native:** a public client with no secret. The auth request opens in the system browser (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android). The redirect is a claimed HTTPS link, not a custom scheme. Capacitor only launches the browser and never renders Google's login.

**2. ID token validation** on every sign-in: JWKS signature, `iss` is `accounts.google.com`, `aud` is our client ID, `exp` not passed, `nonce` matches the stored value, `email_verified` true. The account key is `sub`; email is display data only.

**3. Our tokens.**

- Access token: JWT, 15 minutes, with a `sid` (session family) claim.
- Refresh token: opaque 256-bit value, stored as a SHA-256 hash. Idle lifetime 30 days, absolute 90 days, after which Google sign-in is required.
- Rotation: each refresh issues a new token in the same family. Presenting a retired token revokes the whole family. The client single-flights refreshes so parallel requests do not trigger false reuse.

**4. Revocation.** Logout revokes one family. "Sign out everywhere" revokes all. Revocation takes effect within the 15-minute access token window. Sensitive routes also check the session row.

**5. Biometric unlock.** Biometric data never leaves the device.

- *Enable* (session under 5 minutes old, else Google re-auth): create a non-exportable key in the Secure Enclave (`kSecAttrTokenIDSecureEnclave`, access control `.biometryCurrentSet`) or the Android Keystore (hardware-backed, StrongBox where available, `setUserAuthenticationRequired(true)`, invalidated on enrollment change). Register the public key with the server against the session family.
- *Storage:* the refresh token is kept only as ciphertext wrapped by that key. No plaintext token, no PIN, no default value.
- *Unlock:* biometric prompt releases the key, the app unwraps the token, signs a server nonce with the device key, and refreshes. The server verifies the signature and rotates. A copied token without the device key is useless.
- *Failure or invalidation:* delete the local key and wrapped token; the user signs in with Google (FR-2 fallback). *Disable:* delete the local key and the server device record.

Web has no biometric unlock in MVP.

**Sequence diagrams (text).**

First sign-in (native; web is the same with the backend as client):

```
App -> Backend: start (state, nonce, PKCE verifier)
App -> SystemBrowser: Google auth (code_challenge S256, state, nonce)
User -> Google: sign in, consent
Google -> App: https://app.link/cb?code&state
App -> Backend: callback {code, state, verifier}
Backend -> Google: token exchange
Backend: validate ID token; create account if sub is new; open family
Backend -> App: access JWT + refresh token
```

Enable biometric (recent session):

```
App: create biometric-gated non-exportable key
App: wrap refresh token with key; store ciphertext
App -> Backend: register device public key, session id
Backend: bind key to session family
```

Returning unlock:

```
App: open -> biometric prompt -> key released -> unwrap token
Backend -> App: nonce
App: sign nonce with device key
App -> Backend: refresh {token, device id, signature}
Backend: verify hash and signature; rotate; return access JWT
```

**Account deletion.** Requires Google re-auth within 5 minutes. The server revokes all families and device records, deletes meals, photos and provider keys, then the user row. Immediate in MVP (FR-9). The audit record keeps only a hash of `sub` and a timestamp.

## Alternatives considered

| Option | Trade-off | Verdict |
|---|---|---|
| Passkeys (WebAuthn L3) for unlock | W3C Recommendation 25 Aug 2026. Phishing-resistant, but synced passkeys break device binding, and a passkey login is a second sign-in method the PRD excludes | Revisit post-MVP |
| Embedded webview | Host app can read credentials; disallowed by RFC 8252 and Google | Rejected |
| PIN fallback | Weak secret; FR-3 bans defaults | Rejected |
| Server-held Google refresh token | Extra high-value credential we do not need | Rejected |
| Opaque access tokens | Instant revocation, but a DB hit per request against p95 < 300 ms | Rejected; 15-min JWT |
| Email as account key | Email changes | Rejected; `sub` |

## Consequences

- Positive: one credential source; no password or PIN store; stolen refresh tokens are detectable and useless without the device key.
- Negative: two token paths (cookie and device-bound); session families and device records to maintain; a new device requires Google sign-in.

## Threats addressed

| Threat | Control |
|---|---|
| Code interception | PKCE S256; system browser; claimed HTTPS redirect |
| Login CSRF, code injection | `state`; `nonce` bound to ID token |
| ID token forgery or replay | JWKS signature; `iss`, `aud`, `exp`, `nonce` |
| Refresh token theft | Hashed storage; rotation; reuse revokes family |
| Stolen token on device | Biometric-wrapped; device-key proof on refresh |
| Biometric bypass | Per-use auth; invalidation on enrollment change |
| Default PIN | None exists (FR-3) |
| Token endpoint brute force | Rate limits on auth routes |

## Open risks

- Apple `biometryCurrentSet` behavior and the Capacitor plugin choice are unverified in code. A spike is needed.
- The 90-day lifetime and 5-minute re-auth window are proposals.
- No refresh grace window: a network failure mid-refresh can sign the user out.
- RFC 9700 section 4.14 was truncated in our read; confirm reuse semantics against the full text.

## Sources

Read 2026-10-29 unless noted.

1. RFC 9700, OAuth 2.0 Security BCP (BCP 240), Jan 2025. https://www.rfc-editor.org/rfc/rfc9700
2. RFC 8252, OAuth 2.0 for Native Apps, Oct 2017. https://www.rfc-editor.org/rfc/rfc8252
3. Google, OAuth 2.0 for native apps. https://developers.google.com/identity/protocols/oauth2/native-app
4. Google, OpenID Connect and ID token validation. https://developers.google.com/identity/openid-connect/openid-connect
5. W3C, WebAuthn Level 3 Recommendation, 25 Aug 2026. https://www.w3.org/news/2026/web-authentication-an-api-for-accessing-public-key-credentials-level-3-is-now-a-w3c-recommendation/
6. Apple, `biometryCurrentSet` (title only retrieved; behavior from prior knowledge). https://developer.apple.com/documentation/security/secaccesscontrolcreateflags/biometryCurrentSet
7. Android, Keystore system. https://developer.android.com/privacy-and-security/keystore
8. Lucid, refresh token theft false positives, Sep 2023 (secondary). https://lucid.co/techblog/2023/09/18/avoiding-false-positives-in-oauth-2-0-refresh-token-theft-detection
9. Referenced, not re-fetched: RFC 6749, RFC 7636 (https://www.rfc-editor.org/rfc/rfc7636), OpenID Connect Core 1.0 (https://openid.net/specs/openid-connect-core-1_0.html).
