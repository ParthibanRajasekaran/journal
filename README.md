# Journal

A personal nutrition and training journal: meals with approximate calories and protein, morning weight, actual workouts and
recovery, with optional AI estimates paid for by the user's own provider key. Android and iOS via Capacitor, plus the web.

The product specification is in `docs/spec/` (frozen) and delivery status in `docs/milestones.md`.

## Layout

| Path | What |
|---|---|
| `web/` | The only client: React 18, TypeScript, Vite, Capacitor 8. Native projects in `web/android` and `web/ios`; Google sign-in plugin in `web/plugins`. |
| `backend/` | The only API: FastAPI, PostgreSQL, SQLAlchemy, Alembic. Settings are `JOURNAL_*` environment variables (`backend/.env.example`). |
| `docker/` | Compose stack for a server: Caddy (HTTPS), the API image, PostgreSQL. |
| `ops/` | Backup and disk-alert scripts run from the server crontab. |
| `docs/` | `spec/` (product spec), `adr/` (decisions), `openapi.yaml` (contract, enforced by tests), `release/` (build and deploy runbooks), `evals/` (AI evaluation sets), `legal/`. |
| `scripts/` | `gate.sh` (quality gates) and `agent/` (Claude Code guardrails). |

## Local setup

Requirements: Node 20+, Python 3.12+ with [uv](https://docs.astral.sh/uv/), PostgreSQL on `127.0.0.1:5433`, gitleaks.

```bash
make db-setup                      # creates journal_dev and journal_test
make migrate                       # alembic upgrade head on journal_dev
cp backend/.env.example backend/.env   # fill in the Google client, JWT secret and key-encryption key
cd backend && uv sync && uv run uvicorn app.main:create_app --factory --reload --port 8000
cd web && npm ci && npm run dev    # http://localhost:5173, proxies /api to :8000
```

## Quality gates

```bash
make gate        # fast: only the areas that changed (web typecheck + tests, backend lint + types + tests)
make gate-full   # everything CI runs, plus the web build
make check       # what CI runs: backend lint, mypy, pytest (90% coverage), secret scan, audit, web
make web-e2e-local   # Playwright against http://127.0.0.1:8000 (E2E_BASE_URL is required; there is no live-site default)
```

Every API route must appear in `docs/openapi.yaml`; `backend/tests/test_contract_drift.py` fails otherwise.

## Builds

Android and iOS build, signing and provenance procedures live in `docs/release/`. Release builds never allow cleartext
HTTP and never embed a developer AI key.

## Working with Claude Code

`CLAUDE.md` holds the rules; `docs/milestones.md` is the goal tracker; `scripts/agent/scope.json` names the active milestone
and the paths it may change. Hooks in `.claude/settings.json` block edits outside that scope, secrets, dangerous commands
and stopping with failing gates.
