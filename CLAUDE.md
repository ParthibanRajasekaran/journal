# Journal: working rules for Claude Code

Read this, then `docs/milestones.md`. The product specification is frozen in `docs/spec/` (00 controls scope).

## What this is

A personal nutrition and training journal. `web/` is the only client (React 18, TypeScript, Vite, Capacitor 8; native
projects in `web/android` and `web/ios`). `backend/` is the only API (FastAPI, PostgreSQL, SQLAlchemy, Alembic, `/api/v1`).
There is no other client, no software factory, no OPA. Deployment is a Compose stack in `docker/`; runbooks go in
`docs/release/`.

## Commands

```bash
make gate                 # fast gate for what changed: web typecheck + vitest, backend ruff + mypy + pytest
make gate-full            # everything CI runs plus the web build
make migrate              # alembic upgrade head (local journal_dev on 127.0.0.1:5433)
cd backend && uv run pytest -q [-m m1]        # backend tests; -m selects a milestone's tests
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy
cd web && npm run typecheck && npm test        # vitest; journey tests are named "[M1] ..." etc.
make web-e2e-local        # Playwright against a local backend; E2E_BASE_URL is mandatory, never the live site
scripts/agent/milestone-check.py [M1]          # automated exit criteria for a milestone
```

PostgreSQL must be running on 5433 (`make db-setup` once). Tests never skip when it is down; they fail.

## Goal-driven loop

1. The active milestone and the paths it may change are in `scripts/agent/scope.json`. Hooks deny edits outside it.
2. Open `docs/milestones.md`, take the next unchecked task in the active milestone, and implement the smallest vertical
   slice: migration + model + route + `docs/openapi.yaml` + test, or component + test.
3. `make gate` until green. Tick the task, add an evidence line (kind: mocked test unless you really ran a device),
   commit on `mvp/daily-use` as `M<n>: <what changed>`. Pushing this branch is fine.
4. If something outside scope is needed, write it under `Parked` in `docs/milestones.md` and keep going. Do not widen
   the diff. The owner advances milestones with `scripts/agent/advance.py` after recording manual evidence.
5. When every `auto` exit criterion passes, run `milestone-check.py`, list the owner actions needed, and stop with a
   report: working journeys, exact source SHAs, observed failures, remaining blockers, and the evidence kind for each
   claim (mocked test, real-provider run, emulator, physical device). A passing build is not a finished feature.

Never: merge, push to `main`, deploy, run containers on a server, call a paid provider, or test against the live site.
Ask the owner only for: Google OAuth clients and accounts, devices and signing, beta-stack activation, paid eval runs,
merges. Everything else, decide and continue.

Write files with the Edit and Write tools, not shell redirections or heredocs: the scope guard reads tool calls, and the
Bash guard only sees redirect targets. The guards are tripwires for a cooperative agent, not a sandbox. Do not route
around them; if one blocks something you believe is needed, record it under `Parked` or ask the owner.

## Product invariants (from docs/spec/00, non-negotiable)

- Every AI result is an editable draft. The user confirms before anything enters confirmed records or totals.
- Unknown nutrition is never zero. Unestimated meals are drafts with no numbers; days show incompleteness.
- Confirmed-but-unsynced records count once in totals and are labeled provisional. Never duplicate, never invent.
- No developer-funded AI. The user's own key, explicitly selected provider shown before dispatch, no silent fallback
  or provider switch, limits and a durable usage ledger before broad use.
- Every user-owned row has `user_id`; replayable creates have `client_id` unique with the owner; editable rows have
  `version` (`If-Match`). Mutations carry the expected-account header and are refused for another account.
- Migrations are additive. Local storage migrations copy, verify, then remove the source; never rename data away.
- A missing workout is not a rest day. Plans are separate from performed sessions; actual sets are authoritative.
- AI never writes to confirmed history, never changes targets, never marks a session complete.
- Secrets never enter the repository. Release builds refuse cleartext HTTP and test credentials.

## Sensors already in place

- `docs/openapi.yaml` is the contract: `backend/tests/test_contract_drift.py` fails on any undocumented route.
- `backend/tests/test_no_developer_key.py` fails if Settings grows a provider key or the estimator reads one from the
  environment.
- `backend/tests/test_eval_meals_mock.py` runs the 20-meal eval set through the validator on every gate.
- `web/playwright.config.ts` throws without `E2E_BASE_URL`.
- Hooks in `.claude/settings.json`: scope and secret guard on edits, dangerous-command guard on Bash, lint feedback
  after edits, and a Stop gate that blocks on out-of-scope changes or a failing `make gate`.

## Style

Backend: ruff (line length 100), mypy strict, pytest with markers `m0..m5`, `eval`. Web: TypeScript strict, vitest with
jsdom, components derive labels and totals from domain state. Keep copy plain and honest; estimates are approximate.
