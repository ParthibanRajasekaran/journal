# Journal policies (policy-as-code)

These Rego policies enforce the guardrails in ADR-006. The API and CI evaluate them.
Model output never decides them. Each policy is deterministic and has tests.

Language: Rego v1 (`import rego.v1`). Verified against the OPA GitHub releases page
on 2026-10-29, which showed v1.22.0 as latest. Pin the exact OPA version in CI after
checking the release notes.

## Layout

| File | Enforces (ADR-006) |
|---|---|
| `authz/meals.rego` | Layer a: deny-by-default, owner-only access to meals |
| `ai/provider_consent.rego` | Layer d: no provider call without current, non-revoked consent |
| `ai/estimate_output.rego` | Layer c: schema, ranges, energy check, confidence floor, non-food refusal |
| `ai/estimate_output_test.rego` | Unit tests for `estimate_output.rego` |
| `agents/change_policy.rego` | Layer e: paths an automated agent may and may not change |

Package names follow the directory: `journal.authz.meals`, `journal.ai.consent`,
`journal.ai.estimate`, `journal.agents.change`.

## Run the policies

Install OPA (any v1.x release; the tests were not run in this change because OPA
was not installed on the machine that wrote them).

```sh
# Format check, from the repository root
opa fmt --diff policy/

# Static check
opa check policy/

# Unit tests (verbose; add --coverage for a coverage report)
opa test policy/ -v

# Evaluate one decision by hand, with a local JSON input file.
# Use synthetic data only, never real user records.
opa eval -d policy/ -i scratch/estimate_input.json "data.journal.ai.estimate.result"
```

Only `ai/estimate_output_test.rego` has tests today. `authz`, `consent` and `agents`
need their own `*_test.rego` files before they can gate a release.

## Inputs

Each policy header comment documents its input document. The API builds these
documents for every guarded request. Missing or malformed input must produce a
deny, never an allow. The policies are written to fail closed.

## Release gate

CI runs `opa fmt --diff`, `opa check` and `opa test` on every change. The
model-quality eval gate (ADR-005 and ADR-006 layer f) is separate. It runs the
labelled meal set against each provider adapter.

## Change control

Everything under `policy/` is human-review-only. Automated agents may not change
it (see `agents/change_policy.rego`). Changes need a CODEOWNERS review.
