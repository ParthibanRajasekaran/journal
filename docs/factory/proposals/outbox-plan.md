# Outbox bootstrap and combined candidate: plan for review

Status: plan. Nothing merged, nothing approved, nothing recorded as verified by the factory.

## Current facts (checked 31 October 2026)

| Item | Value |
|---|---|
| `main` | `b5f296f`. No `factory/`, no `tools/`, no checker. Not protected. |
| Bootstrap checker | `review/bootstrap-policy-check` at `07e3ffe`, parent `main`. Stdlib only, 4 files plus the CI job. |
| Combined candidate | `review/outbox-candidate-v2` at `8a4d74f`, parent `b5f296f`. 13 paths. |
| Factory admission of the candidate | **Refused.** Ten `web/src` paths have no authorisation under the current policy. |
| Independent review of the candidate | **None.** No authorised reviewer exists. Review is pending. |

## Bootstrap diff (smallest)

Files, all in `07e3ffe`:

- `tools/policy_check.py`: the checker. Reads the policy and approvals at the base; reads the pull request as data.
- `tools/__init__.py`, `tools/tests/__init__.py`, `tools/tests/test_policy_check.py`: 12 tests. They cover the decision
  rules, the approval rules, and the trust regression: a pull request that replaces the checker is rejected by the
  trusted checker and passes only when it judges itself.
- `.github/workflows/ci.yml`: a `policy-check` job, marked as not required, that runs `tools/policy_check.py` from a
  trusted checkout of the base commit.

Run result: `python3 -m unittest discover -s tools/tests -t . -p "test_*.py"` gives 12 tests, all passing.

## Combined candidate

`8a4d74f`, built from `b5f296f` with exactly these 13 paths:

- Web: `App.tsx`, `api.ts`, `api.test.ts`, `offline.ts`, `offline.test.ts`, `session.ts`, `vite-env.d.ts`,
  `screens/AddMeal.tsx`, `screens/Today.tsx`, `screens/Settings.tsx`.
- Backend: `backend/app/routes/meals.py`, `backend/tests/test_expected_account.py`.
- Contract: `docs/openapi.yaml`.

Excluded on purpose: the factory, the policy, the approvals file, native-auth files, CI, and any Android or iOS file.

Why both halves: the web fix sends `X-Journal-Expected-Account`, and the server's refusal is what makes a cross-account
write safe. A web-only candidate is not independently deployable.

### Informational gates (run on `8a4d74f`, not factory evidence)

| Gate | Result |
|---|---|
| Web typecheck | pass |
| Web unit tests | 71 pass |
| Web build | pass |
| Backend tests (local PostgreSQL test database) | 256 pass |
| Ruff lint, ruff format, mypy | clean |

The candidate's identity and cleanliness were not checked by the factory, because the factory refused admission.

### Admission status (bootstrap checker, `b5f296f`..`8a4d74f`)

Ten violations, all `policy: not authorized ... web/src/*`. No violation on backend or docs paths, because those are
already inside the current policy's roots.

## Plan after authorisation

Only after both of these are recorded on `main`:

1. the bootstrap checker, or equivalent, is on `main`, and
2. `web/src/*` is authorised, by option A or by the narrow approval in `docs/factory/policy-exceptions.json`.

Then, in order:

1. Update the outbox ticket's `allowed_paths` to the 13 paths, in its own reviewable change.
2. Run `python3 -m factory plan <ticket>` and confirm "ready to run".
3. Run `python3 -m factory run <ticket> --candidate 8a4d74f`. The controller refuses a dirty worktree, checks identity
   before and after gates, and after review, and records evidence against the exact SHA.
4. The factory's dry-run reviewer is **not** independent review, and the controller will refuse it as evidence of
   readiness.

## Independent review: instructions

Status: pending. No authorised reviewer has reviewed `8a4d74f`. Do not claim a review from a dry-run adapter, from the
author, or from this document.

Reviewer, for `8a4d74f`:

1. Check out `8a4d74f` and confirm `git diff --stat b5f296f 8a4d74f` lists exactly the 13 paths above.
2. Read the web outbox (`offline.ts`) and check that no path sends a write while the outbox is unsafe.
3. Read `meals.py` and check that the expected-account check runs before any read or write, and that a
   mismatch returns 409.
4. Run the gates listed above, from a clean checkout of `8a4d74f`.
5. Report findings against `8a4d74f`. Any new commit is a new candidate, and needs a new review.

## What this plan does not show

- That production runs the backend change. It does not.
- That the web fix works against the real backend in a browser. The Playwright end-to-end tests were not run on this candidate.
- That the factory can verify this candidate. It cannot until authorisation is recorded.
