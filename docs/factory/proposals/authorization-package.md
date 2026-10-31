# Authorization package (for owner decision)

Status: prepared, not approved. No item below is approved, and nothing here records an approval. Each item
states the files it touches, why, what is still uncertain, and the exact owner action. Items are independent, so
you may approve some and not others.

Ordering constraint: items 1 and 2 must be merged to `main` through human review before the factory's admission
and the CI check can read them, because both read the policy and approvals from the base commit. The
bootstrap sequence is in `ci-policy-check.md` section 4.

## 1. Policy option A, with the narrowest exception that works

- **Files:** `policy/agents/change_policy.rego` (replace with `docs/factory/proposals/change_policy.option-a.rego`).
  `docs/factory/policy-exceptions.json` (no entry needed if option A is adopted).
- **Purpose:** agents may change `web/src/**` and `web/e2e/**`. Native shells, `factory/**`, the approvals file and
  lock files stay protected. The OPA tests and a Python-versus-OPA check agree on 16 paths.
- **Narrowest alternative if you do not adopt A:** a single approval entry for prefix `web/src/` only, with status
  `approved` and your name as `approved_by`. This covers the outbox candidate's client files, and it does not
  cover `web/e2e/`, `web/android/` or `ios/`. Do not use the broad prefix `web/`.
- **Uncertainty:** the proposed policy has not been exercised against a real agent-authored pull request.
- **Owner action:** review `change_policy.option-a.rego`, then merge it through CODEOWNERS review. Or add the single
  `web/src/` approval to `docs/factory/policy-exceptions.json` on `main`, with your own name, after you have read
  the outbox diff.

## 2. ADR-004 amendment

- **Files:** `docs/adr/0004-authentication-and-biometric-unlock.md` (human edit; agents may not edit `docs/adr/**`).
  Proposal text: `docs/factory/proposals/adr-004-amendment.md`.
- **Purpose:** the native flow uses the platform SDK and an ID-token exchange, not a browser redirect. Native nonce
  validation stays, and is server-bound through the attempt contract in
  `docs/factory/proposals/native-auth/DESIGN.md`.
- **Uncertainty:** the claims in the contract that are marked unproven, especially the `aud`/`azp` values and
  Android Credential Manager behaviour. These are settled by the spike, not by this amendment.
- **Owner action:** decide whether to accept the SDK approach, then edit the ADR yourself or ask for a separate PR.

## 3. Native authentication implementation

- **Files (proposed):**
  - `backend/app/routes/native_auth.py` (new route module for the attempt contract).
  - `backend/app/auth/*` changes, if the verifier needs them. These fall under `**/auth/**`, which is
    human-review-only for agents.
  - `backend/migrations/versions/<new>.py` for the `native_attempts` table.
  - `backend/app/db/models.py` (the table model).
  - `docs/openapi.yaml` (the new operations).
  - `web/src/session.ts`, `web/src/screens/SignIn.tsx`, `web/src/api.ts` (client handling).
  - `web/android/app/src/main/AndroidManifest.xml` (removal of the unused `USE_BIOMETRIC`).
- **Purpose:** sign-in through the platform SDK, one attempt per login, no account ID as input, server-side nonce
  binding, atomic consumption, and session tokens unchanged from ADR-004.
- **Uncertainty:** whether the SDKs return tokens whose `aud` and `azp` match the expected client IDs. Whether
  Credential Manager can return a credential minted before the request. Both are unproven until the spike.
- **Owner action:** approve the implementation, and name a human reviewer for `backend/app/auth/**`. An agent cannot
  approve its own auth change.

## 4. Move `ios/` under `web/`

- **Files:** `ios/**` moves to `web/ios/**` (git rename, no content change intended). `web/capacitor.config.ts`
  is already the config.
- **Purpose:** Capacitor sync can then reach the iOS platform. Without this, `npx cap sync ios` fails with
  "ios platform has not been added yet", as shown earlier.
- **Uncertainty:** Xcode project references (SPM package paths, `CapApp-SPM`) may need edits after the move.
  Not verified.
- **Owner action:** approve the move. Then run the simulator build, which I will report separately.

## 5. Pinned dependencies

- **Files:** `web/package.json`, `web/package-lock.json`.
  - `@capgo/capacitor-social-login` exact `8.7.5`. **License: MPL-2.0** (file-level copyleft). Repository:
    `github.com/Cap-go/capacitor-social-login`. Peer `@capacitor/core >=8.0.0`.
  - `@aparajita/capacitor-secure-storage` exact `8.0.1`. **License: MIT.** Peer Capacitor 8.
- **Purpose:** the sign-in SDK wrapper and the secure token store. Their storage limits are stated in the proposal:
  the keychain and Keystore store is not biometric-bound.
- **Uncertainty:** the MPL-2.0 licence obligations for modified files (none are planned). Whether the plugin's
  Android and iOS native code passes your review. Not reviewed beyond the README and the `GoogleProvider` read.
- **Owner action:** accept the MPL-2.0 licence for the social-login plugin, or name an alternative. Then approve
  the two pins.

## 6. CI workflow and ownership protections

- **Files:** `.github/workflows/ci.yml` (add the `policy-check` job from `ci-policy-check.md` section 5). `.github/CODEOWNERS`
  (new, base branch only). Branch protection (owner settings, not a file).
- **Purpose:** the checker runs from a trusted base checkout. Workflow and checker edits need owner review. Stale
  approvals are dismissed on new pushes.
- **Uncertainty:** whether CODEOWNERS on the base branch is what GitHub enforces against a pull request that edits
  it (unverified). Whether a trusted required workflow is available on this account (unverified). The effect of
  "include administrators" on a single-owner repository.
- **Read-only state today:** no branch protection, no rulesets, no CODEOWNERS, one collaborator.
- **Owner action:** apply the settings in `ci-policy-check.md` section 2, then test the CODEOWNERS behaviour in a
  throwaway repository before relying on it.

## What is not in this package

- The outbox candidate. It is rebuilt only after items 1 and the backend account check are merged to `main`, as
  step 4 of the plan describes. Per the review, it includes the backend `X-Journal-Expected-Account`
  change from `22dc519`, because the web fix relies on it.
- Live AI probes. They stay disabled until the owner has checked the extra-usage setting and recorded that
  attestation personally.
- Any merge, deployment, publication or paid usage.
