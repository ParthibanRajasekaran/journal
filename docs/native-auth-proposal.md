# Native sign-in for Android and iOS: proposal, revision 3 (for review)

Status: proposal, not implemented and not approved. Revision 3 replaces revision 2. It withdraws the
browser-redirect design, because the Capacitor Browser plugin has no supported way to return an OAuth redirect
to the app on iOS. It also changes ADR-004's native flow, which needs an explicit owner amendment
(`docs/factory/proposals/adr-004-amendment.md`). The agent policy protects `docs/adr/**`, so this proposal does
not edit the ADR.

## Verified facts, with sources

| Claim | Source | Checked |
|---|---|---|
| Capacitor Browser uses SFSafariViewController on iOS. The docs give no guidance on capturing an OAuth redirect into the app. | [Capacitor Browser API docs](https://capacitorjs.com/docs/apis/browser) | 31 Oct 2026, WebFetch |
| The Browser plugin cannot return a redirect to the app on iOS. Native ASWebAuthenticationSession is a feature request. | [Capacitor feature request thread](https://outsystems.canny.io/capacitor-feature-requests/p/support-sso-flow-in-browser-plugin) | 31 Oct 2026, search summary only |
| Google's OAuth policy: create a separate OAuth client per platform (web, Android, iOS). Do not use a web client for a native app. | [Google OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies) | 31 Oct 2026, search summary only |
| iOS backend validation: check that `aud` matches one of the app's client IDs, `iss` is accounts.google.com, `exp` has not passed, and the signature checks against Google's keys. Use an official library. | [Google Sign-In iOS backend auth](https://developers.google.com/identity/sign-in/ios/backend-auth) | 31 Oct 2026, search summary only |
| On iOS, retrieving an ID token needs a second, server client ID, set with `GIDServerClientID`. The reversed client ID goes in `CFBundleURLSchemes`. | Same Google iOS page | 31 Oct 2026, search summary only |
| Android Credential Manager: pass the **Web** client ID as the server client ID. Do not pass the Android client ID. The Android client needs only the exact package name and SHA-1. Digital Asset Links are not required. | `@capgo/capacitor-social-login` 8.7.5 README, "Android troubleshooting" section | 31 Oct 2026, npm readme |
| The plugin returns `result.idToken` and accepts a nonce. `GoogleLoginOptions.nonce` is in its type definitions. Android calls `setNonce`. iOS passes the nonce to Google Sign-In, and a login with a nonce always signs in rather than restoring a previous token. | `@capgo/capacitor-social-login` 8.7.5 tarball: `dist/esm/definitions.d.ts`, `android/.../GoogleProvider.java`, `ios/.../GoogleProvider.swift` | 31 Oct 2026, read from the pinned package |
| Plugin peer: `@capacitor/core >=8.0.0`. Capacitor 8 compatible. | npm peer dependencies | 31 Oct 2026 |
| Emulator `Medium_Phone_API_36.0` uses `google_apis_playstore`, so Play services are present. | Local AVD and SDK config | 31 Oct 2026 |
| Debug keystore SHA-1, public fingerprint only: `9B:63:12:33:3A:6D:BC:09:83:F9:2E:B8:DB:39:F4:6E:0A:A0:F3:46`. | `keytool -list` on `~/.android/debug.keystore` | 31 Oct 2026 |
| Production backend: health 200, Google sign-in start configured with the web client ID. | Read-only probes, earlier checkpoint | 31 Oct 2026 |

The search summaries are secondary. Before any implementation, the spike must confirm the iOS `aud` behaviour
on a real token, using the official pages.

## Decision: use the platform SDK, not the browser redirect

Google's guidance for Android and iOS is to use the platform sign-in SDK, which puts the account chooser in
system UI. The app gets an ID token, and the backend verifies it. This avoids the browser redirect, so the
iOS return problem and the App Link requirement both go away.

The Capacitor integration is `@capgo/capacitor-social-login` 8.7.5, pinned exactly. It is a maintained plugin
and it targets Capacitor 8. This is a choice, not a fact that the plugin is safe. The spike must check it.

## Exact configuration (owner creates these, once)

| Item | Value | Where |
|---|---|---|
| Web OAuth client (existing, production) | the client ID already used by `JOURNAL_GOOGLE_CLIENT_ID` | Google Cloud, Credentials. Used as `webClientId` and `iOSServerClientId`. This is the backend audience. |
| iOS OAuth client (new) | bundle ID `com.journal.nutrition` (from `capacitor.config`) | Google Cloud. Gives `iOSClientId` and the reversed client ID for `CFBundleURLSchemes`. |
| Android OAuth client (new) | package `com.journal.nutrition`, SHA-1 of the signing key | Google Cloud. Console only, never passed to the app. Use the debug SHA-1 above for a personal test build, and register the release SHA-1 separately when it exists. |
| OAuth consent screen | Testing mode, with each test account added under Test users | Google Cloud |

No new credential is needed for the backend audience. Do not put any secret in the app bundle.

## Backend changes

Before each login, the app calls `POST /api/v1/auth/native/nonce` with `X-Journal-Request: 1`. The server generates
a random nonce of 256 bits, stores `sha256(nonce)` with an expiry of five minutes and a null `used_at`, and returns
the nonce. The app passes it as `GoogleLoginOptions.nonce` on every login, including iOS restored sign-ins.

`POST /api/v1/auth/native/google` `{id_token}`, with `X-Journal-Request: 1`:

1. Verify the signature against Google's JWKS. Accept only `iss` in {`accounts.google.com`,
   `https://accounts.google.com`}. Reject if `exp` has passed.
2. `aud` must equal the web client ID. If `azp` is present, it must equal the web client ID, or the iOS
   client ID for an iOS token. The spike confirms which values real tokens carry.
3. `email_verified` must be true. The account key is `sub`.
4. Nonce binding, atomically: the token's `nonce` claim must be the value this login was issued. Look it up by
   `sha256(nonce)` and consume it in one statement: `UPDATE native_nonces SET used_at = now() WHERE nonce_hash = $1
   AND used_at IS NULL AND expires_at > now() RETURNING 1`. Zero rows returns 401. A nonce that was never issued,
   has expired, or has already been used is refused.
5. One-time token use, as a second check: insert `sha256(id_token)` with its `exp` into `native_id_token_uses`
   with a unique key, using `INSERT ... ON CONFLICT DO NOTHING RETURNING`. Zero rows returns 401. Prune after `exp`.
6. Upsert the user, apply the adult-confirmation rule that already exists, call `service.start_session`, and
   return `{access_token, refresh_token, expires_in}`.

Also: `POST /native/refresh` and `POST /native/logout`, as in revision 2, and Bearer acceptance in
`current_user_id`. The expected-account header from R2 applies to every native write.

Migration: `native_nonces(nonce_hash primary key, expires_at, used_at)` and `native_id_token_uses(token_hash primary key, expires_at)`.

## Deviations from ADR-004 (owner decision required)

- ADR-004 §1 describes an authorization-code flow with PKCE and a claimed HTTPS redirect. The SDK flow returns
  an ID token directly, with no authorization code and no PKCE on our side.
- ADR-004 §2's nonce check is kept for native, bound to the server-issued nonce above. This is not a
  deviation. The plugin supports the nonce, so nothing is weakened.
- The Journal session (15-minute access token, rotating refresh token, family revocation) is unchanged.

## Storage

`@aparajita/capacitor-secure-storage` 8.0.1, as in revision 2. OS keychain on iOS; Android Keystore AES-GCM with
app-private SharedPreferences. It is not biometric-bound. ADR-004 §5 is not met by this plugin alone.

## Spike (before any production code)

1. Android emulator, `google_apis_playstore`: the plugin with the Web client ID and the Android client for the
   debug SHA-1. Check the ID token's `aud`, `azp`, `iss`, `exp`, `email_verified` and `nonce`.
   Nonce tests: a token with an unissued nonce, a token whose nonce was already used, and a token whose
   nonce has expired are each refused.
2. Backend: verify that token offline against the JWKS, and confirm the one-time-use rule rejects a replay.
3. iOS: needs the `ios/` shell in `web/` (not yet done) and a signed build for a device. Simulator only is
   reported as partial.

Google sign-in needs a person with their own account. The agent does not enter credentials.

## Required decisions

1. Approve the SDK approach and the ADR-004 amendment (`docs/factory/proposals/adr-004-amendment.md`), or keep the
   redirect design and accept its iOS gap.
2. Create the iOS and Android OAuth clients with the exact values above, when you choose to run the spike.
3. Approve the plugin, or name another maintained one.
4. Approve moving `ios/` under `web/`.
5. Decide the policy for `web/**`, per `docs/factory/policy-reconciliation.md`.
