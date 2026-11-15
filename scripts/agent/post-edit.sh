#!/usr/bin/env bash
# PostToolUse hook for Edit/Write: quick lint feedback on the file just changed. Never blocks.
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
FILE="$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)"
[ -n "$FILE" ] || exit 0
case "$FILE" in
  "$ROOT"/*) REL="${FILE#"$ROOT"/}" ;;
  *) REL="$FILE" ;;
esac
OUT=""
case "$REL" in
  backend/*.py)
    OUT="$(cd "$ROOT/backend" && uv run ruff check "${FILE}" 2>&1; uv run ruff format --check "${FILE}" 2>&1)" ;;
  web/src/*.ts|web/src/*.tsx)
    OUT="$(cd "$ROOT/web" && npx tsc --noEmit 2>&1 | head -n 30)" ;;
  *) exit 0 ;;
esac
if [ -n "$OUT" ] && ! echo "$OUT" | grep -qE '^(All checks passed!|[0-9]+ files? (already|would be left) (formatted|unchanged))' ; then
  if echo "$OUT" | grep -qE 'error|Error|would be reformatted|F[0-9]{3}|E[0-9]{3}'; then
    jq -cn --arg ctx "post-edit check for $REL reported problems; fix before moving on:
$OUT" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
  fi
fi
exit 0
