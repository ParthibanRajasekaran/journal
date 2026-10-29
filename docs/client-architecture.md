# Client architecture: server-driven UI or native apps?

Status: Draft · Date: 2026-10-29 · Related: ADR-003 (client framework), ADR-004 (biometrics), `docs/prd.md`

## 1. The question

Should the server describe what each screen looks like (server-driven UI, SDUI), or should each app contain its own screens (native, or a single client codebase that ships them)?

## 2. Short answer

**Ship the screens in the app. Let the server send data and a few settings, never layout.** That is a client-rendered app with an API, packaged for the web and the two stores with Capacitor (ADR-003). It is not full SDUI.

Revisit SDUI only if the team needs to change screen layout without store releases, and only after the MVP has real users.

## 3. The three options

### Option A: Server-driven UI

The server returns a JSON description of each screen; a thin native renderer draws it.

Advantages:
- Layout changes and experiments without store review.
- One backend change updates every platform.

Disadvantages for Journal:
- **Store risk.** Apple's App Review Guidelines restrict downloaded code that changes an app's features. Layout JSON is usually allowed, but reviewers judge case by case, and a rejected update blocks users.
- **Security.** A compromised or misconfigured server can change what the user sees, including what they are asked to consent to. That is a larger attack surface for a health app. Guardrails (ADR-006) would need to cover UI descriptions too.
- **Offline.** Screens must be cached and versioned. The offline logging requirement (FR-8) makes this harder.
- **Testing.** Two renderers (iOS and Android) plus the server schema must agree. More test surface, more bugs.
- **Cost.** Building and maintaining a renderer takes more effort than the whole MVP screen set (four screens, about twelve components).

Verdict: poor fit for a four-screen app with a small team.

### Option B: Native apps (Swift for iOS, Kotlin for Android)

Two separate codebases, each with native UI. A web app would be a third codebase.

Advantages:
- Best platform feel, accessibility, and performance.
- Direct access to Keychain, Secure Enclave, Keystore, and BiometricPrompt without a bridge.
- Native gives the most control over start-up time and memory. App size is roughly comparable with a Capacitor build of the same screens; measure both.

Disadvantages:
- Three UIs (web, iOS, Android) to build and keep in step, or two if the web app is dropped.
- Two sets of tooling, two sets of security reviews, two dependency trees to audit.
- Slower to build with a small team. Conflicts with the "lightweight and efficient" aim only in build effort, not runtime.

Verdict: strongest runtime and security control, highest build cost. Worth it if the product later needs deep platform features.

### Option C: One client codebase, packaged for each platform (recommended)

React and Vite UI (the existing web app), wrapped by Capacitor for Android and iOS. Native plugins handle biometrics, secure storage, and SQLite (ADR-003). The server supplies data and feature settings only.

Advantages:
- One UI to design, test, and secure. Matches the design direction in the UI review.
- Reuses existing code; the Capacitor config already exists in the repo.
- Keeps the security-critical parts native: biometric keys and refresh tokens use platform stores through the plugins.
- No server-controlled layout, so the attack surface stays small.

Disadvantages:
- A WebView renders the UI. Scrolling and animation are usually fine on current phones but can lag on low-end Android. Measure before launch.
- Native look is approximated; platform conventions need care (safe areas, back gestures).
- Some plugins are single-maintainer (ADR-003 flags MPL-2.0 risk). Keep them behind an interface so they can be replaced.

Verdict: best balance for this app's size, budget, and security posture.

## 4. Comparison

| Criterion | A: SDUI | B: Native | C: Shared client (recommended) |
|---|---|---|---|
| Time to MVP | Slow | Slow | Fast |
| Build and maintenance cost | High | High | Low |
| Store review risk | Medium | Low | Low |
| Security surface | Larger (server controls UI) | Smallest | Small |
| Offline support | Hard | Good | Good (SQLite plugin) |
| Platform feel | Medium | Best | Good |
| Performance ceiling | Medium | Best | Good; measure |
| Change UI without release | Yes | No | No (web-level changes only) |
| Biometric and key control | Via plugins | Native | Via plugins (ADR-004) |

## 5. Decision triggers to revisit

Move to native (Option B) for a platform if any of these happen:
- Start-up time or scroll smoothness fails the target on mid-range Android after optimization.
- The app needs a platform feature with no maintained plugin.

Consider SDUI only if all of these hold:
- The team needs to change screens several times a month without store releases.
- The app has enough users that experiments are worth the build cost.
- The threat model in ADR-006 is extended to cover UI descriptions.

## 6. What the server sends (to keep this decision honest)

- Data: meals, days, weeks, profile, consents (see `docs/openapi.yaml`).
- Settings: feature flags (boolean, server-set), provider list, daily-target limits.
- Never: layout, copy that changes flow, or executable code.

## 7. Risks to track

- WebView performance on low-end Android (measure in the first build).
- Plugin maintenance for biometrics and secure storage (watch release dates).
- Apple review of the biometric prompt wording (must match ADR-004).
