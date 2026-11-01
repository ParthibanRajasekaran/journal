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

## What is enforced now (review R4)

- **Admission** (`factory/policy_gate.py`, used by `factory/controller/core.py`): a ticket's allowed paths
  must be inside the policy's allowed roots, or covered by an approval status `approved` with a named
  approver. Pending entries authorize nothing. Refused before any run record or worktree exists.
- **Trusted inputs:** the policy and the approvals are read from the run's base commit, not from the
  candidate. `docs/factory/policy-exceptions.json` is always protected, so a change set cannot approve
  itself, whatever a project file says.
- **Change-set check:** every candidate change is judged against the same rule, with protected paths
  refused even when allowed.
- **CI command:** `python3 -m factory policy-check --base REF --head REF` judges a diff and exits 2 on
  any violation. It is not yet wired into CI; see `docs/factory/proposals/`.
- **Plan status:** `plan` reports "ready to run" or "review preparation only: owner approval is required
  before execution".

## What is not enforced yet

- **CI does not run `policy-check`.** That needs a change to `.github/workflows/ci.yml`, which is
  human-review-only. The snippet is in `docs/factory/proposals/ci-policy-check.md`, not applied.
- **Option A is not in force.** `policy/agents/change_policy.rego` is unchanged. The proposal is in
  `docs/factory/proposals/change_policy.option-a.rego`. Its OPA tests pass, and the Python enforcement
  agrees with it on a path matrix.
- **No owner approval is recorded.** `docs/factory/policy-exceptions.json` has no approved entry, so the
  outbox ticket is refused at admission. That is the correct state until the owner decides.

## What the tests do not prove

They prove the two rule sets agree as written, and that the enforcement refuses what the policy refuses. They
do not prove the policy itself is correct, and they do not stop a tool from acting outside the worktree.
