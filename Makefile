# Single entry point for every quality gate. `make check` must pass before merging.
# Uses the same commands as pre-commit (.pre-commit-config.yaml) and CI (.github/workflows/ci.yml).

.PHONY: check lint typecheck test policy secrets audit hooks

check: lint typecheck test policy secrets audit

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .

typecheck:
	cd backend && uv run mypy

test:
	cd backend && uv run pytest --cov --cov-report=term-missing

policy:
	opa check policy
	opa test policy

# Scans the full git history, not just the working tree, so an old committed key is caught too.
secrets:
	gitleaks git --no-banner --redact --log-level warn

audit:
	cd backend && uv run pip-audit
	cd backend && uv run bandit -q -r tests -s B101   # assert is the test idiom; app code will not skip it

hooks:
	pre-commit install
