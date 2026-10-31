# Authorization package (for owner decision)

Status: prepared, not approved. Nothing in this document is approved, and nothing here records an approval under
any name. The two requests are independent: approving one does not approve the other. Each item states the files
it touches, why, what is still uncertain, and the exact owner action.

Sources the requests depend on, all on branches for review, not on `main`:

- `review/bootstrap-policy-check` at `07e3ffe`: the stdlib checker and a non-required CI job.
- `review/outbox-candidate-v2` at `8a4d74f`: the combined outbox candidate (web and backend paths only).
- `review/factory-bootstrap` at its current tip: the factory package, the native attempt model and this package.

---

## Request 1: Outbox bootstrap and outbox candidate

Goal: land the checker on `main`, then merge the outbox candidate. This request does not include native sign-in.

### 1a. Bootstrap the change-set checker onto `main`

- **Files:** `tools/policy_check.py`, `tools/__init__.py`, `tools/tests/__init__.py`, `tools/tests/test_policy_check.py`,
  and a new `policy-check` job in `.github/workflows/ci.yml`. Commit `07e3ffe` on `review/bootstrap-policy-check`.
- **Purpose:** the checker can judge a pull request from a trusted base checkout. Until it is on `main`, the
  trusted-base workflow cannot run.
- **Why this is the smallest diff:** one stdlib module, its tests, and one job. It does not add the factory package,
  change the policy, or touch the approvals file.
- **Uncertainty:** the checker's rules are a re-implementation of `factory/policy_gate.py`. A cross-check test on the
  factory branch keeps them aligned, but that test only runs where the factory exists. The job is not required,
  because no protection is enabled yet.
- **Owner action:** review `tools/` and the job, then merge `review/bootstrap-policy-check` through a pull request you
  review yourself. Do not enable the status as required in this step.

### 1b. Admit the outbox candidate's web paths

The backend and docs paths in the candidate are already allowed by the current policy. Only the ten `web/src` files need
a decision. Checked with the bootstrap checker against `b5f296f`..`8a4d74f`: **10 violations, all `web/src/*`, and no
violation on backend or docs paths.**

Choose one:

- **Option A (proposed):** adopt `docs/factory/proposals/change_policy.option-a.rego`, which adds `web/src/**` and
  `web/e2e/**` to the allowed roots. **Files:** `policy/agents/change_policy.rego` (human-review-only).
  **Uncertainty:** broader than this candidate needs, because it allows future `web/src` work without a
  ticket-by-ticket decision. **Owner action:** review and merge through CODEOWNERS.
- **Narrow alternative:** one approval entry in `docs/factory/policy-exceptions.json` with prefix `web/src/`,
  `status: "approved"`, and your name in `approved_by`. **Uncertainty:** the approval is recorded on the base
  branch, so it must be merged to `main` before the factory admits the ticket. **Owner action:** write the entry
  yourself, after reading the candidate diff. Do not use the broad prefix `web/`.

### 1c. Merge the combined outbox candidate

- **Candidate:** `8a4d74f` on `review/outbox-candidate-v2`, built from `b5f296f` with 13 paths: 10 web files, the backend
  route `backend/app/routes/meals.py`, `backend/tests/test_expected_account.py`, and `docs/openapi.yaml`.
- **Why the backend is included:** the web fix relies on the server refusing a write for another account.
  Without the backend change, the web candidate is not safe to deploy on its own.
- **Informational gates on `8a4d74f`** (not factory evidence): web typecheck, 71 tests and build pass. Backend 256 tests
  pass against the local PostgreSQL test database, and ruff, format and mypy are clean.
- **Uncertainty:** the backend change touches the production API contract, and production does not run it yet.
  The web client sends the header to the server, which would reject it with 422 if it did not recognise it. This is
  not yet tested against production.
- **Owner action:** after 1a and 1b, merge the candidate through review, or ask for a factory run on the exact SHA.

### 1d. Settings that enforce review (owner settings, not repository code)

- Branch protection on `main`: require a pull request with one approval, require review from code owners, dismiss
  stale approvals on new pushes, require the `ci` check, restrict pushes, and disallow force pushes.
- CODEOWNERS on `main` covering `.github/**`, `factory/**`, `tools/**`, `policy/**` and `docs/factory/**`.
- **Read-only state today (31 October 2026):** no protection, no rulesets, no CODEOWNERS file, one collaborator.
- **Uncertainty:** whether GitHub enforces CODEOWNERS from the base branch or from the pull request. Not verified.
  Test in a throwaway repository before relying on it.
- **Owner action:** apply the settings, and run the throwaway test.

---

## Request 2: Native sign-in

Goal: implement the attempt contract and the SDK sign-in, after the design is accepted. This request is separate from
Request 1, and it does not depend on it, except that the backend change in 1c is reused.

### 2a. ADR-004 amendment

- **Files:** `docs/adr/0004-authentication-and-biometric-unlock.md` (human edit). Text: `docs/factory/proposals/adr-004-amendment.md`.
- **Purpose:** the native flow uses the platform SDK, and the nonce stays server-bound.
- **Uncertainty:** the spike has not run, so the amendment rests on unproven claims. See `native-auth/EVIDENCE.md`.
- **Owner action:** accept or reject the amendment, and edit the ADR yourself or ask for a separate change.

### 2b. Native authentication implementation (after 2a)

- **Files (proposed, not written):** `backend/app/routes/native_auth.py` (new). `backend/app/auth/**` changes if the
  verifier needs them, which are human-review-only for agents. A migration for `native_attempts` and
  `native_id_token_uses`. `docs/openapi.yaml`. `web/src/session.ts`, `web/src/screens/SignIn.tsx`, `web/src/api.ts`.
  `web/android/app/src/main/AndroidManifest.xml`, to remove the unused `USE_BIOMETRIC`.
- **Purpose:** one attempt per login, a server-bound nonce, a single transaction for consumption and session creation,
  and session tokens unchanged from ADR-004. The model and its rollback tests are in
  `docs/factory/proposals/native-auth/`.
- **Uncertainty:** every item marked pending in `native-auth/EVIDENCE.md`, including the `aud`/`azp` values, Credential
  Manager behaviour, Postgres row locking and crash rollback.
- **Owner action:** approve the implementation after the spike, and name a human reviewer for `backend/app/auth/**`.
  An agent cannot approve its own auth change.

### 2c. Move `ios/` under `web/`

- **Files:** `ios/**` to `web/ios/**` (a rename, no content change intended).
- **Purpose:** `npx cap sync ios` can then reach the platform. Before this, the sync fails with "ios platform has not
  been added yet", as shown earlier.
- **Uncertainty:** Xcode project references may need edits after the move. Not verified.
- **Owner action:** approve the move.

### 2d. Pinned dependencies

- **Files:** `web/package.json`, `web/package-lock.json`.
  - `@capgo/capacitor-social-login` exact `8.7.5`. **License: MPL-2.0** (file-level copyleft). Peer `@capacitor/core >=8.0.0`.
  - `@aparajita/capacitor-secure-storage` exact `8.0.1`. **License: MIT.**
- **Purpose:** the SDK wrapper and secure token storage. Storage is not biometric-bound, and that limit is stated.
- **Uncertainty:** MPL-2.0 obligations for any modified file (none planned). The plugin's native code has been read in
  part only.
- **Owner action:** accept MPL-2.0 for the social-login plugin, or name a replacement. Then approve both pins.

### 2e. OAuth clients (you create these in Google Cloud)

- **Web application client:** the existing production client. Used as `webClientId` and `iOSServerClientId`.
- **iOS client:** bundle ID `com.journal.nutrition`. Gives `iOSClientId` and the reversed client ID for `CFBundleURLSchemes`.
- **Android client:** package `com.journal.nutrition` and the SHA-1 of the signing key. The debug SHA-1 is
  `9B:63:12:33:3A:6D:BC:09:83:F9:2E:B8:DB:39:F4:6E:0A:A0:F3:46`. A release SHA-1 is needed for a release build.
- **Consent screen:** Testing mode, with each test account added.
- **Uncertainty:** whether a second Google client is needed. The plugin documentation names only these three.
- **Owner action:** create the iOS and Android clients with these values, when you choose to run the spike.

---

## Not in either request

- Merging, deploying, publishing, or enabling paid usage.
- Live AI probes. They stay disabled until you check the extra-usage setting yourself and record that attestation.
- Any approval recorded under any name, including the owner's. The factory and checker do not record approvals.
