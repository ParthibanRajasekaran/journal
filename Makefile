# Single entry point for every quality gate. `make check` must pass before merging.
# Uses the same commands as pre-commit (.pre-commit-config.yaml) and CI (.github/workflows/ci.yml).

# Local PostgreSQL used by database tests. CI overrides PG_PORT=5432 with a service container.
PG_HOST ?= 127.0.0.1
PG_PORT ?= 5433
PG_USER ?= $(shell whoami)
export JOURNAL_TEST_DATABASE_URL ?= postgresql+asyncpg://$(PG_USER)@$(PG_HOST):$(PG_PORT)/journal_test

.PHONY: check preflight lint typecheck test policy secrets audit hooks db-setup web

check: preflight lint typecheck test policy secrets audit web

# Fail fast with a clear message rather than letting the database tests error out.
preflight:
	@pg_isready -h $(PG_HOST) -p $(PG_PORT) >/dev/null 2>&1 || \
		(echo "PostgreSQL is not reachable at $(PG_HOST):$(PG_PORT). Start it, then run 'make db-setup'." >&2; exit 1)

# Creates the development and test databases if they do not exist.
db-setup:
	-createdb -h $(PG_HOST) -p $(PG_PORT) journal_dev 2>/dev/null
	-createdb -h $(PG_HOST) -p $(PG_PORT) journal_test 2>/dev/null

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .

typecheck:
	cd backend && uv run mypy

test:
	cd backend && uv run pytest --cov=app --cov=tests --cov-report=term-missing --cov-fail-under=90

policy:
	opa check policy
	opa test policy

# Scans the full git history, not just the working tree, so an old committed key is caught too.
secrets:
	gitleaks git --no-banner --redact --log-level warn

audit:
	cd backend && uv run pip-audit
	cd backend && uv run bandit -q -r app
	cd backend && uv run bandit -q -r tests -s B101   # assert is the test idiom; app code will not skip it

hooks:
	pre-commit install

# Web screens: type-check, unit tests, and a production build.
web:
	cd web && npm ci --no-audit --no-fund && npm run typecheck && npm test && npm run build

# Factory controller tests. Stdlib only; no model calls, no network writes.
.PHONY: factory
factory:
	python3 -m unittest factory.tests.test_factory factory.tests.test_providers
