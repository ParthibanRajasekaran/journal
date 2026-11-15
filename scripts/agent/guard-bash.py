#!/usr/bin/env python3
"""PreToolUse hook for Bash: block deployment, destructive git, live-site tests, paid calls, guard edits."""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import deny_pre, read_input  # noqa: E402

PROVIDER_HOSTS = r"(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)"
SAFE_RM = r"(node_modules|/dist\b|\bdist/|\.venv|coverage|htmlcov|\bbuild/|/build\b|scratchpad|/private/tmp|/tmp/|" \
          r"\.pytest_cache|\.mypy_cache|\.ruff_cache|__pycache__|playwright-report|test-results|\.DS_Store)"
GUARDED_PATHS = r"(scripts/agent/|\.claude/|docs/spec/)"
WRITE_OPS = r"(sed\s+-i|>{1,2}\s*\S|\btee\b|\bcp\b|\bmv\b|\brm\b|python3?\s|\bperl\b|\btouch\b|\bgit\s+(rm|mv)\b|\bchmod\b)"


def main() -> None:
    data = read_input()
    cmd = (data.get("tool_input", {}) or {}).get("command", "") or ""
    c = " ".join(cmd.split())
    stripped = c.lstrip('"').lstrip()

    if re.search(r"\bgit\s+push\b", c) and re.search(r"(\bmain\b|--force\b|\s-f\b|--delete\b|\s\+\S)", c):
        deny_pre("git push to main, force pushes and ref deletion are owner actions. Push the integration "
                 "branch only: git push origin mvp/daily-use.")
    if re.search(r"\bgh\s+pr\s+merge\b", c) or re.search(r"\bgit\s+merge\b.*\bmain\b", c):
        deny_pre("Merging is the owner's decision. Prepare the branch and the report; do not merge.")
    if re.search(r"\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f|\bgit\s+checkout\s+--\s+\.|\bgit\s+restore\s+\.\s*$", c):
        deny_pre("Destructive git working-tree commands are blocked. Revert a specific file with "
                 "`git checkout -- <file>` or ask the owner.")
    if re.search(r"\brm\s+(-[a-zA-Z]*r[a-zA-Z]*|--recursive)\b", c):
        targets = [t for t in re.split(r"\s+", c.split("rm", 1)[1]) if t and not t.startswith("-")]
        if any(not re.search(SAFE_RM, t) for t in targets):
            deny_pre("Recursive delete outside build/cache directories is blocked. Use `git rm` for tracked "
                     "files (reversible) or ask the owner.")
    if re.search(r"(^|[\s;&|])(ssh|scp|rsync|sftp)\s", c):
        deny_pre("Remote shell and file transfer to servers are owner actions (deployment). Write the runbook "
                 "in docs/release/ instead and ask the owner to run it.")
    if re.search(r"\bdocker\s+(compose\s+)?(up|down|push|exec|run|rm|restart|stop)\b|\bdocker\s+push\b", c):
        deny_pre("Starting, stopping or pushing containers is deployment. `docker compose config` and "
                 "`docker build` are fine; everything else needs the owner.")
    if re.search(r"\b(vercel|fly|oci|gcloud|aws)\s+(deploy|run|up|launch)\b|\bvercel\s+--prod\b", c):
        deny_pre("Cloud deployment commands are owner actions.")
    if re.search(r"(playwright\s+test|npm\s+run\s+e2e|npx\s+playwright)", c) and "E2E_BASE_URL=" not in c \
            and "make web-e2e-local" not in c:
        deny_pre("Playwright needs an explicit E2E_BASE_URL (a local backend). Use `make web-e2e-local` or "
                 "prefix the command with E2E_BASE_URL=http://127.0.0.1:8000. Never the live site.")
    if "getrendercheck.com" in c and re.search(r"(playwright|e2e|curl\s+-X\s+(POST|PATCH|DELETE)|--data)", c):
        deny_pre("The live site is production. Do not run journeys or writes against it.")
    if re.search(r"\b(dropdb|DROP\s+DATABASE)\b", c, re.I) and not re.search(r"journal_(test|verify_)", c):
        deny_pre("Only the test databases (journal_test, journal_verify_*) may be dropped.")
    if re.search(r"\balembic\s+downgrade\b", c):
        deny_pre("alembic downgrade is an owner action. Migrations are additive; write a new migration instead.")
    if "eval_provider" in c and "JOURNAL_EVAL_AUTHORIZED=1" not in c:
        deny_pre("Real-provider evaluation spends the owner's money. It runs only when the owner authorizes it, "
                 "with JOURNAL_EVAL_AUTHORIZED=1 on the command line.")
    if re.search(r"\b(curl|wget|http|https)\b", c) and re.search(PROVIDER_HOSTS, c):
        deny_pre("Ad-hoc calls to AI providers are blocked (they cost money and bypass the usage ledger). "
                 "Use the mocked tests, or the authorized eval script.")
    if "assembleRelease" in c and "JOURNAL_ANDROID_TEST_CLEARTEXT" in c:
        deny_pre("A release build must never allow cleartext HTTP.")
    if re.search(GUARDED_PATHS, c) and re.search(WRITE_OPS, c) and not re.match(
            r'^("?\$CLAUDE_PROJECT_DIR"?/)?(\./)?scripts/agent/(milestone-check|advance|session-brief)\.py\b', stripped):
        deny_pre("Shell writes to scripts/agent/, .claude/ or docs/spec/ are blocked; those are owner-controlled. "
                 "Milestones advance through scripts/agent/advance.py.")


if __name__ == "__main__":
    main()
