# Outbox bootstrap and combined candidate: plan for review

Status: plan. Nothing merged, nothing approved, nothing recorded as verified by the factory. Values in
`<angle brackets>` are placeholders. They are filled in only after the step that produces them runs.

## Current facts (checked 31 October 2026)

| Item | Value |
|---|---|
| `main` | `b5f296f`. No checker, no `tools/`, no `factory/`. Not protected. |
| Bootstrap checker | `review/bootstrap-policy-check` at `883f8c3` (parent `main`). Checker, 12 tests, and a policy-check job with an explicit bootstrap-stage failure. |
| Candidate (pre-recreation) | `review/outbox-candidate-v2` at `8a4d74f`, parent `b5f296f`. 13 paths. Gates run as information only. |
| Ticket `base_commit` | `b5f296f`, pending recreation. |
| Factory admission of the candidate | **Refused.** Ten `web/src` paths are not authorised under the current policy. |
| Independent review | **None.** No authorised reviewer has reviewed any candidate. |

## Bootstrap stage (documented, not an enforcement run)

Until the checker is on `main`, the policy-check job cannot find `tools/policy_check.py` at the base. It fails with:

> BOOTSTRAP STAGE, NOT AN ENFORCEMENT RESULT: the base branch has no tools/policy_check.py, so no change can be judged.

That failure is expected. It is not a pass, and it is not reported as one. The job is not required, so the failure does
not block merging, and the bootstrap pull request itself is reviewed by a person, as described in
`authorization-package.md`.

## Bootstrap diff (smallest)

`review/bootstrap-policy-check` at `883f8c3`, on top of `07e3ffe`:

- `tools/policy_check.py`: stdlib checker. Reads the policy and approvals at the base. Reads the pull request as data.
- `tools/__init__.py`, `tools/tests/__init__.py`, `tools/tests/test_policy_check.py`: 12 tests, covering the decision
  rules, approval rules, and the trust regression.
- `.github/workflows/ci.yml`: the policy-check job, with the bootstrap-stage check before the checker runs.

## Combined candidate (pre-recreation)

`8a4d74f`, from `b5f296f`, 13 paths:

- Web (10): `App.tsx`, `api.ts`, `api.test.ts`, `offline.ts`, `offline.test.ts`, `session.ts`, `vite-env.d.ts`,
  `screens/AddMeal.tsx`, `screens/Today.tsx`, `screens/Settings.tsx`.
- Backend (2): `backend/app/routes/meals.py`, `backend/tests/test_expected_account.py`.
- Contract (1): `docs/openapi.yaml`.

It excludes the factory, the policy, the approvals file, CI, native-auth files and every Android or iOS file.

The web fix sends `X-Journal-Expected-Account`, and the server's refusal is what makes a cross-account write safe.
A web-only candidate is not independently deployable.

## Verification gates

The factory's project gates now cover both halves. A candidate is verified only with all seven:

| Gate | Command (cwd) | Needs |
|---|---|---|
| `web-typecheck` | `npm run --silent typecheck` (`web`) | the shared `web/node_modules` link |
| `web-unit` | `npx vitest run` (`web`) | as above |
| `web-build` | `npm run --silent build` (`web`) | as above |
| `backend-tests` | `uv run --locked pytest -q` (`backend`) | `JOURNAL_TEST_DATABASE_URL` in the operator's environment. A missing variable fails the gate closed, with the variable's name and never its value. |
| `backend-lint` | `uv run --locked ruff check . --output-format concise` (`backend`) | none |
| `backend-format` | `uv run --locked ruff format --check .` (`backend`) | none |
| `backend-types` | `uv run --locked mypy` (`backend`) | none |

Status of these gates on `8a4d74f`: **informational only.** They were run by hand on that commit, and the factory did
not run them. Results at that time: web typecheck, 71 unit tests and build pass; backend 256 tests pass against the local
PostgreSQL test database; ruff lint, format and mypy are clean. The factory's own gate runs are still pending.

## After bootstrap and authorisation: recreate the candidate

These steps run only after the checker is on `main` and an authorisation for `web/src` is recorded on `main`. None of
them has run.

1. Record the new base: `<M1>` is the `main` SHA after the bootstrap merge.
2. Confirm the authorisation is on `<M1>`. Run `python3 tools/policy_check.py --repo . --base <M1> --head <M1>` and
   check the admission result for the ticket's paths.
3. Recreate the candidate on the new base. Create a worktree from `<M1>`, check out the same 13 paths from the source
   commit used for `8a4d74f`, and commit. Record the new SHA as `<C2>`. Do not reuse `8a4d74f`: its parent is `b5f296f`.
4. Update the ticket's `base_commit` to `<M1>`, and its `allowed_paths` to the 13 paths. Make this a separate commit, on
   its own branch from `<M1>`.
5. Run `python3 -m factory plan <ticket>` and confirm "ready to run".
6. Run `python3 -m factory run <ticket> --candidate <C2>` with `JOURNAL_TEST_DATABASE_URL` set. The controller checks
   identity and cleanliness before gates and after gates and review, and records evidence against `<C2>`.
7. Report `<C2>`, the evidence path, and the result. Do not report a pass from any run that was not made by the factory.

If any authorised item changes the web or backend source, the candidate is rebuilt, and the new SHA is reported.

## Independent review

Status: pending. No authorised reviewer has reviewed `8a4d74f` or any later candidate. The dry-run adapter is not
review, and neither is the author's own review, nor this document.

Reviewer instructions, for `<C2>` once it exists:

1. Check out `<C2>`. Confirm `git diff --stat <M1> <C2>` lists exactly the 13 paths.
2. Read `offline.ts` and confirm that no path sends a write while the outbox is unsafe.
3. Read `meals.py` and confirm that the expected-account check runs before any read or write, and that a mismatch returns 409.
4. Run the seven gates from a clean checkout of `<C2>`.
5. Report findings against `<C2>`. Any new commit is a new candidate and needs a new review.

The reviewer is a second account with write access, from the arrangement in `ci-policy-check.md` section 2a. The author
of the candidate does not review it.

## What this plan does not show

- That production runs the backend change. It does not.
- That the web fix works against the real backend in a browser. The Playwright end-to-end tests were not run.
- That the factory can verify any candidate. It cannot until the authorisation is recorded on `main`.
