#!/usr/bin/env bash
# One reproducible command for the required checks. It runs every gate and records what was run.
#
#   scripts/verify.sh            run all checks on the working tree (refuses a dirty tree unless --allow-dirty)
#   scripts/verify.sh --allow-dirty
#
# Database: a disposable LOCAL database on 127.0.0.1 only. The script refuses any other host, and it never reads
# production settings. It prints the database NAME, never a connection string with credentials.
# Independent review is NOT produced here. This script records checks; review is a separate, named step.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 1

ALLOW_DIRTY=0
[ "${1:-}" = "--allow-dirty" ] && ALLOW_DIRTY=1

PGHOST=127.0.0.1
PGPORT="${JOURNAL_VERIFY_PORT:-5433}"
DB_NAME="${JOURNAL_VERIFY_DB:-journal_verify}"
case "$DB_NAME" in *[!a-zA-Z0-9_]*|"") echo "verify: database name must be letters, digits or underscore"; exit 2 ;; esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/.factory-local/verify/$STAMP"
mkdir -p "$OUT"
SUMMARY="$OUT/summary.txt"
: > "$SUMMARY"

FAILED=0
step() {
  local name="$1"; shift
  local log="$OUT/$(echo "$name" | tr ' /' '__').log"
  if "$@" >"$log" 2>&1; then
    echo "PASS  $name" | tee -a "$SUMMARY"
  else
    echo "FAIL  $name   (log: ${log#"$ROOT"/})" | tee -a "$SUMMARY"
    FAILED=1
  fi
}

# 1. Candidate identity: the exact commit and tree that these checks describe.
HEAD_SHA="$(git rev-parse HEAD)"
TREE_SHA="$(git rev-parse HEAD^{tree})"
DIRTY="$(git status --porcelain --untracked-files=all | grep -v '^?? docs/qa/' || true)"
{
  echo "candidate-head  $HEAD_SHA"
  echo "candidate-tree  $TREE_SHA"
  echo "run-stamp       $STAMP"
} | tee -a "$SUMMARY"
if [ -n "$DIRTY" ] && [ "$ALLOW_DIRTY" -eq 0 ]; then
  echo "FAIL  clean worktree: uncommitted or untracked changes present (the notes-only docs/qa/ folder is ignored here)" | tee -a "$SUMMARY"
  echo "$DIRTY" | tee -a "$SUMMARY"
  exit 1
fi
[ -n "$DIRTY" ] && echo "NOTE  running with uncommitted changes (--allow-dirty); results do not describe a commit" | tee -a "$SUMMARY"

# 2. Local disposable test database.
if ! pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "FAIL  postgres: nothing is listening on $PGHOST:$PGPORT. Start a local server, then rerun." | tee -a "$SUMMARY"
  exit 1
fi
createdb -h "$PGHOST" -p "$PGPORT" "$DB_NAME" >/dev/null 2>&1 || true
export JOURNAL_TEST_DATABASE_URL="postgresql+asyncpg://$(whoami)@$PGHOST:$PGPORT/$DB_NAME"
echo "info  test database: $DB_NAME on $PGHOST:$PGPORT (local, disposable)" | tee -a "$SUMMARY"

# 3. Gates.
step "factory unit tests"        python3 -m unittest discover -s factory/tests -t . -p "test_*.py"
step "native attempt model"      python3 -m unittest discover -s docs/factory/proposals/native-auth -p "test_*.py"
step "backend tests"             bash -c "cd backend && uv run --locked pytest -q"
step "backend lint"              bash -c "cd backend && uv run --locked ruff check . --output-format concise"
step "backend format"            bash -c "cd backend && uv run --locked ruff format --check ."
step "backend types"             bash -c "cd backend && uv run --locked mypy"
step "web typecheck"            bash -c "cd web && npm run --silent typecheck"
step "web unit tests"            bash -c "cd web && npx vitest run"
step "web build"                 bash -c "cd web && npm run --silent build"
step "secret scan (history)"     gitleaks git --no-banner --log-level error

# 4. Review status. Recorded, never inferred.
echo "info  independent review: NOT PERFORMED by this script. See docs/factory/proposals/outbox-plan.md." | tee -a "$SUMMARY"
echo "" | tee -a "$SUMMARY"
if [ "$FAILED" -eq 0 ]; then echo "RESULT: all gates passed for $HEAD_SHA" | tee -a "$SUMMARY"; else echo "RESULT: one or more gates FAILED for $HEAD_SHA" | tee -a "$SUMMARY"; fi
echo "record: ${SUMMARY#"$ROOT"/}"
exit "$FAILED"
