#!/usr/bin/env bash
# One reproducible command for the required checks. Every gate runs against the committed tree, and the
# candidate's identity (HEAD, tree, and the list of uncommitted files) is checked before and after EACH gate,
# so a gate that changes the candidate fails at that gate.
#
#   scripts/verify.sh                 clean tree only. Exit 0 = all gates passed on one commit.
#   scripts/verify.sh --allow-dirty   records a DIRTY RUN. Its results describe no commit. Exit 3 even on success.
#
# Database: a fresh, uniquely named database on 127.0.0.1, created by this run. A name that already exists, or a
# failed creation, aborts the run. The script drops that database on exit and never touches any other one.
# It never reads production settings and never prints a connection string with credentials.
# Independent review is NOT performed by this script. Its status is recorded, never inferred.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 1

ALLOW_DIRTY=0
[ "${1:-}" = "--allow-dirty" ] && ALLOW_DIRTY=1

PGHOST=127.0.0.1
PGPORT="${JOURNAL_VERIFY_PORT:-5433}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/.factory-local/verify/$STAMP"
mkdir -p "$OUT"

# ---- candidate identity ------------------------------------------------------------------------------------
pending_files() { git status --porcelain --untracked-files=all | grep -v '^?? docs/qa/' | sort || true; }
identity() {
  printf 'head %s\ntree %s\nfiles %s\n' "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" "$(pending_files | shasum -a 256 | cut -c1-16)"
}
ID_INITIAL="$(identity)"
HEAD_SHA="$(git rev-parse HEAD)"
TREE_SHA="$(git rev-parse HEAD^{tree})"
DIRTY_LIST="$(pending_files)"

if [ "$ALLOW_DIRTY" -eq 1 ]; then
  SUMMARY="$OUT/DIRTY-RUN-summary.txt"
  TAG="DIRTY"
else
  SUMMARY="$OUT/summary.txt"
  TAG=""
fi
: > "$SUMMARY"
say() { echo "$*" | tee -a "$SUMMARY"; }

say "candidate-head  $HEAD_SHA"
say "candidate-tree  $TREE_SHA"
say "run-stamp       $STAMP"
if [ -n "$DIRTY_LIST" ]; then
  if [ "$ALLOW_DIRTY" -eq 0 ]; then
    say "FAIL  clean worktree: uncommitted or untracked files are present"
    echo "$DIRTY_LIST" | tee -a "$SUMMARY"
    exit 1
  fi
  say "DIRTY RUN  uncommitted or untracked files are present. These results do not describe the commit above."
  echo "$DIRTY_LIST" | tee -a "$SUMMARY"
fi

# ---- disposable database -----------------------------------------------------------------------------------
if ! pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  say "FAIL  postgres: nothing is listening on $PGHOST:$PGPORT. Start a local server, then rerun."
  exit 1
fi
DB_NAME="journal_verify_$(openssl rand -hex 6)"
case "$DB_NAME" in journal_verify_????????????) ;; *) say "FAIL  internal: generated database name is malformed"; exit 2 ;; esac
CREATED=0
cleanup() {
  if [ "$CREATED" -eq 1 ]; then
    dropdb -h "$PGHOST" -p "$PGPORT" --if-exists "$DB_NAME" >/dev/null 2>&1 || echo "WARN  could not drop $DB_NAME; drop it by hand" >&2
  fi
}
trap cleanup EXIT
if psql -h "$PGHOST" -p "$PGPORT" -d postgres -Atqc "select 1 from pg_database where datname = '$DB_NAME'" 2>/dev/null | grep -q 1; then
  say "FAIL  database name collision: $DB_NAME already exists. Refusing to reuse it."
  exit 1
fi
if ! createdb -h "$PGHOST" -p "$PGPORT" "$DB_NAME" >/dev/null 2>&1; then
  say "FAIL  could not create the disposable database $DB_NAME"
  exit 1
fi
CREATED=1
export JOURNAL_TEST_DATABASE_URL="postgresql+asyncpg://$(whoami)@$PGHOST:$PGPORT/$DB_NAME"
say "info  test database: $DB_NAME on $PGHOST:$PGPORT (created by this run, dropped on exit)"

# ---- gates, each followed by an identity check -------------------------------------------------------------
FAILED=0
step() {
  local name="$1"; shift
  local log="$OUT/${name// /_}.log"
  "$@" >"$log" 2>&1
  local code=$?
  local after; after="$(identity)"
  if [ "$after" != "$ID_INITIAL" ]; then
    say "FAIL  $name changed the candidate (HEAD, tree or uncommitted files differ afterwards)"
    FAILED=1
  elif [ "$code" -eq 0 ]; then
    say "PASS${TAG:+ ($TAG)}  $name"
  else
    say "FAIL${TAG:+ ($TAG)}  $name   (log: ${log#"$ROOT"/})"
    FAILED=1
  fi
}

step "factory unit tests"    python3 -m unittest discover -s factory/tests -t . -p "test_*.py"
step "native attempt model"  python3 -m unittest discover -s docs/factory/proposals/native-auth -p "test_*.py"
step "backend tests"         bash -c "cd backend && uv run --locked pytest -q"
step "backend lint"          bash -c "cd backend && uv run --locked ruff check . --output-format concise"
step "backend format"        bash -c "cd backend && uv run --locked ruff format --check ."
step "backend types"         bash -c "cd backend && uv run --locked mypy"
step "web typecheck"         bash -c "cd web && npm run --silent typecheck"
step "web unit tests"        bash -c "cd web && npx vitest run"
step "web build"             bash -c "cd web && npm run --silent build"
step "secret scan (history)" gitleaks git --no-banner --log-level error

# ---- result ------------------------------------------------------------------------------------------------
say "info  independent review: NOT PERFORMED by this script. See docs/factory/proposals/outbox-plan.md."
if [ "$ALLOW_DIRTY" -eq 1 ]; then
  if [ "$FAILED" -eq 0 ]; then say "RESULT: DIRTY RUN passed. NOT a verification of $HEAD_SHA."; EXIT=3; else say "RESULT: DIRTY RUN failed."; EXIT=1; fi
else
  if [ "$FAILED" -eq 0 ] && [ "$(identity)" = "$ID_INITIAL" ]; then
    say "RESULT: all gates passed for $HEAD_SHA, with the candidate unchanged throughout."
    EXIT=0
  else
    say "RESULT: verification FAILED for $HEAD_SHA."
    EXIT=1
  fi
fi
echo "record: ${SUMMARY#"$ROOT"/}"
exit "$EXIT"
