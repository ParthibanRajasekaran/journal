# ADR-006: Guardrails and policy-as-code

**Status:** Proposed, 2026-10-29. Owner: Security and LLM architecture. Relates to ADR-001 (API), ADR-004 (auth), ADR-005 (AI port). Implements PRD FR-3, FR-4, FR-5, FR-7, FR-10 and sections 6 and 7.

## Context

Model output changes with provider and model version, and coding agents change code. Behaviour that matters (who sees a meal, what reaches a provider, what gets saved) must not depend on a prompt. ADR-005 covers the output schema but keeps range checks in application code and does not cover authorization, consent or agent changes. Models propose; policy decides.

## Decision

Use OPA with Rego. Policies live in `policy/` (see `policy/README.md`) and are tested with `opa test`. The API evaluates them server-side on every guarded request and fails closed on error or undefined decisions.

**(a) Authorization.** Every `/api/v1` route maps to an action and a resource type. A dependency calls `journal.authz.meals` before the handler runs. Deny by default. Owner-only: `resource.owner_id == user.id`, and the session must be active (ADR-004). List routes must filter by the caller's id. Public routes are an explicit list: `/health` and the sign-in exchange (ADR-001). CI fails if any route lacks a policy binding. The SQL layer also filters every query by `user_id`, so a policy bug does not leak rows. Rate limits (ADR-001) are separate.

**(b) Input guardrails.** Applied before any provider call:
- Photos: maximum 10 MB raw (proposal). Type is sniffed from magic bytes (JPEG, PNG, WebP). The image is re-encoded, which strips EXIF and GPS data.
- Text: maximum 1,000 characters (proposal). Control characters are rejected.
- Prompt-injection markers (for example "ignore previous instructions" or role tags): flagged and rejected. This is heuristic. The real control is that user text sits inside a fixed template, and output policy (c) limits what a hijacked model can return.
- PII minimization: the provider payload carries only the photo or text and the output schema. It never carries user id, email, `sub`, device id, or other meals.

**(c) Output guardrails.** `journal.ai.estimate` checks each reply after Pydantic shape validation. Rego is authoritative for these rules:
- Schema: required fields present, no unknown fields, enums for meal type and confidence.
- Ranges (ADR-005 limits): calories 0 to 5000 kcal, protein 0 to 500 g, carbs 0 to 800 g, fat 0 to 500 g.
- Plausibility: stated calories must be within max(50 kcal, 25%) of 4 x protein + 4 x carbs + 9 x fat.
- Confidence floor: `low` is rejected.
- Non-food refusal: a required `is_food` boolean. `false` returns `refuse`, and the user sees "not a meal" with manual entry.

The decision is `accept`, `reject` or `refuse`. A reject never clamps values. The user gets manual entry (FR-4, FR-5). No fixed fallback numbers are returned.

**(d) Provider policy.** `journal.ai.consent` allows a provider call only with a non-revoked consent for that provider at the current copy version. Gemini free trains on API data (see open risk 1), so its consent also needs `acknowledged_training`. No cross-provider fallback (ADR-005). Terms per provider live in the policy and are reviewed before each release. An EU VPS (ADR-002) does not change that calls go to US processors. The transfer basis and whether meal data is GDPR Art. 9 health data need counsel review.

**(e) Agent-change policy.** `journal.agents.change` decides each changed path. Agents may write under `src/`, `backend/`, `tests/` and `docs/`. Denied to agents, and human-review-only: `policy/`, `docs/adr/`, `docs/prd.md`, `evals/` (labels and thresholds), auth modules (`**/auth/**`, `**/authz/**`, `src/services/biometricAuth.ts`), `.github/`, and `.env*`. An agent cannot approve any change. Humans merge protected paths through CODEOWNERS review. Agents never edit eval thresholds to make a gate pass.

**(f) Eval gate.** CI runs the 150-meal labelled set (ADR-005) on every adapter with pinned model IDs. A release is blocked if the schema-valid rate is below 100%, if any provider's calorie error rises more than 5 points over baseline, or if the estimate policy rejects more than baseline. A nightly run against the default provider alerts on drift.

## Alternatives considered

- **OPA with Rego (chosen).** General-purpose. One language covers authorization, output checks, consent and agent rules. `opa test` gives unit tests and decision logs for audit. Rego v1 is the default since OPA 1.0. Cost: a new language, and a runtime (sidecar REST or WASM inside the Python API).
- **Cedar.** Strong for authorization only. Output ranges and agent-path rules would still be hand-written. A possible later choice for authz alone.
- **Casbin.** Embedded RBAC and ABAC. Weak on JSON validation and offers no shared test story.
- **Hand-written checks in Python.** Cheapest now, but coupled to the app, hard to review or run in CI on their own, and prone to drift. Rejected as the only control.
- **Pydantic and JSON Schema alone.** Kept for shape only. They cannot express cross-field rules, consent or authorization.

## Consequences

- Policy changes are reviewed and tested separately from app code.
- Fail-closed means an unreachable policy engine stops guarded requests. Accepted for MVP.
- Range rules move from ADR-005 into Rego. ADR-005 should point here.

## Open risks

1. **Gemini free tier may use content to improve Google products.** The pricing page (updated 2026-10-28) says "Used to improve our products" for free tier, and ADR-005 cites human review. The default provider needs a product decision.
2. **Schema mismatch.** ADR-001 uses `calories` and numeric confidence (0.82). ADR-005 uses `calories_kcal` and `low | medium | high`. The policy follows ADR-005. ADR-001 must change. `is_food` is in neither schema yet and must be added to both.
3. **Heuristic injection markers** give false positives and misses.
4. **Plausibility thresholds** (25%, 50 kcal) are guesses until the eval set calibrates them.
5. **OPA version.** Search snippets showed older versions than the releases page. Pin after checking release notes.

## Sources

Read 2026-10-29.

- Repository: `docs/prd.md`, ADRs 0001 to 0005.
- OPA latest release: https://github.com/open-policy-agent/opa/releases/latest (fetched; v1.22.0).
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing (fetched; updated 2026-10-28).
- Rego v1 import: https://www.openpolicyagent.org/projects/regal/rules/imports/use-rego-v1.md (search snippet).
- OPA 1.0 announcement: https://blog.openpolicyagent.org/opa-1-0-is-coming-heres-what-you-need-to-know-c8fb0d258368 (search snippet).
