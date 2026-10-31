# Proposed amendment to ADR-004 (native sign-in), for owner decision

Status: proposal. The ADR itself is human-review-only (`docs/adr/**`), so it is not edited here.

## Change to section 1 (native flow)

Replace the native bullet with:

- **Native:** a public client with no secret. Sign-in uses the platform Google sign-in SDK through
  `@capgo/capacitor-social-login` (pinned). Android uses Credential Manager. iOS uses the Google Sign-In SDK.
  The app obtains a Google ID token and sends it to `POST /api/v1/auth/native/google`. The backend verifies it
  and issues Journal tokens. The system browser redirect and the claimed HTTPS redirect are withdrawn for
  native, because the Capacitor Browser plugin does not support returning an OAuth redirect on iOS.

## Change to section 2 (ID token validation)

Keep the signature, `iss`, `aud`, `exp` and `email_verified` checks. Add the `azp` check. Keep the nonce check
for native, and make it server-bound: the backend issues a single-use nonce for each login attempt, stored as a
hash with an expiry. The app passes it as `GoogleLoginOptions.nonce` (supported by the pinned plugin, 8.7.5).
The backend requires the ID token's `nonce` claim to equal it, and consumes it atomically. One-time use of each
ID token is a second check on top of this, not a substitute for it.

## Unchanged

Session tokens (section 3), revocation (section 4), biometric unlock (section 5, still a later step).

## Evidence required before adoption

- A spike on Android emulator (`google_apis_playstore`) showing the token claims for the configured clients.
- A replay test: the second use of the same ID token is refused.
- Confirmation from a real device (not the emulator) before any release.
