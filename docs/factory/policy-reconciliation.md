# Reconciling factory scope with the agent change policy

Status: proposal for owner review. Nothing here changes `policy/`, which is human-review-only.

## The conflict

`policy/agents/change_policy.rego` allows an automated agent to write only under `src/**`,
`backend/**`, `tests/**` and `docs/**`, and it denies everything else. The Journal client was moved to
`web/` after that policy was written, and the factory's own code lives in `factory/`. Earlier work on
this branch wrote into `web/`, `android/`, `factory/`, `Makefile` and `.gitignore`. Those writes do not
fit the policy as written.

## What this change does

1. **Tightens protection (no loosening).** `factory/projects/journal.json` now protects every glob the
   agent policy protects: `evals/**`, `**/auth/**`, `**/authz/**`, `src/services/biometricAuth.ts`,
   `.env` and `**/.env*`. The factory protects a superset of the policy.
2. **Records the allowed-but-not-policy paths as exceptions.** `docs/factory/policy-exceptions.json`
   lists each ticket path outside the policy's roots, with the tickets that use it. It is marked
   `pending-owner-approval`.
3. **Tests the agreement.** `factory/tests/test_policy_alignment.py` fails when:
   - a policy protected path is missing from the factory list;
   - a ticket path is neither inside the policy roots nor covered by a declared exception;
   - an exception no ticket uses is left in the file.

## Options for the owner

| Option | Effect | Who must act |
|---|---|---|
| A. Add `web/**` to the policy's allowed roots | Agents may change the canonical client. Auth paths stay protected. | Owner edits `policy/agents/change_policy.rego` with CODEOWNERS review |
| B. Keep `web/**` human-only | Agents may not change the client. Client tickets are done by a person. | Owner removes the exception and narrows the ticket |
| C. Keep the exception as it is | Client work stays a recorded exception until A or B is chosen | Nothing |

Recommendation: option A, restricted to `web/src/**` and `web/e2e/**`. `web/android/**` and `ios/**`
are native shells and should stay human-only. `factory/**` should stay human-only, because the
controller decides what agents may do.

## Enforcement gap found while doing this

Nothing evaluates `agents/change_policy.rego` against a change set. The CI workflow runs `make check`,
which runs `opa check` and `opa test` on `policy/`. `agents/` has no `*_test.rego`, and no workflow
passes a diff to `journal.agents.change`. ADR-006 (e) and `policy/README.md` describe enforcement that
does not exist yet. Until a change-set check is wired into CI, the policy is documentation, and the
factory's scope check is the only path-level control on agent writes.

## What the tests do not prove

They prove the two rule sets agree as written. They do not check that the policy is correct, and they
do not enforce it. Wiring `journal.agents.change` into CI, with its own tests, is a separate change for
the owner.
