#!/usr/bin/env bash
# Quality gate for agents and humans.
#   gate.sh --fast   checks only the areas that changed (working tree + last commit)
#   gate.sh --full   everything CI runs (make check) plus the web build
# Exit 0 when every step passed. Prints one verdict line per step.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MODE="${1:---fast}"
FAILED=0

step() {  # step <name> <command...>
  local name="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then
    echo "ok    $name"
  else
    echo "FAIL  $name"
    echo "$out" | tail -n 60 | sed 's/^/      /'
    FAILED=1
  fi
}

changed_files() {
  { git diff --name-only HEAD~1 HEAD 2>/dev/null; git status --porcelain --untracked-files=all | awk '{print $NF}'; } | sort -u
}

PG_HOST="${PG_HOST:-127.0.0.1}"; PG_PORT="${PG_PORT:-5433}"
export JOURNAL_TEST_DATABASE_URL="${JOURNAL_TEST_DATABASE_URL:-postgresql+asyncpg://$(whoami)@$PG_HOST:$PG_PORT/journal_test}"

if [ "$MODE" = "--full" ]; then
  step "make check" make check
  step "web build" bash -c "cd web && npm run --silent build"
  [ "$FAILED" -eq 0 ] && echo "GATE PASSED (full)" || echo "GATE FAILED (full)"
  exit "$FAILED"
fi

FILES="$(changed_files)"
WEB=0; BACKEND=0
echo "$FILES" | grep -qE '^web/' && WEB=1
echo "$FILES" | grep -qE '^backend/|^docs/openapi\.yaml$' && BACKEND=1

if [ "$WEB" -eq 1 ]; then
  [ -d web/node_modules ] || step "web npm ci" bash -c "cd web && npm ci --no-audit --no-fund --silent"
  step "web typecheck" bash -c "cd web && npm run --silent typecheck"
  step "web unit tests" bash -c "cd web && npx vitest run --silent"
fi
if [ "$BACKEND" -eq 1 ]; then
  step "backend ruff" bash -c "cd backend && uv run ruff check . && uv run ruff format --check ."
  step "backend mypy" bash -c "cd backend && uv run mypy"
  if pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
    step "backend pytest" bash -c "cd backend && uv run pytest -q -x -p no:cacheprovider"
  else
    echo "SKIP  backend pytest (PostgreSQL not reachable at $PG_HOST:$PG_PORT; start it and run 'make db-setup')"
    echo "GATE_PG_UNAVAILABLE=1"
  fi
fi
if [ "$WEB" -eq 0 ] && [ "$BACKEND" -eq 0 ]; then
  echo "ok    nothing in web/ or backend/ changed"
fi
[ "$FAILED" -eq 0 ] && echo "GATE PASSED (fast)" || echo "GATE FAILED (fast)"
exit "$FAILED"
