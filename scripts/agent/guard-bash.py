#!/usr/bin/env python3
"""PreToolUse hook for Bash: block deployment, destructive git, live-site tests, paid calls, guard edits.

Heredoc bodies are stripped before matching, so a commit message or file body that merely mentions a
guarded path does not trip the rules. Redirect and tee targets are checked against the active scope.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import active, deny_pre, in_scope, matches, override_active, read_input, rel  # noqa: E402

PROVIDER_HOSTS = r"(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)"
SAFE_RM = r"(node_modules|/dist\b|\bdist/|\.venv|coverage|htmlcov|\bbuild/|/build\b|scratchpad|/private/tmp|/tmp/|" \
          r"\.pytest_cache|\.mypy_cache|\.ruff_cache|__pycache__|playwright-report|test-results|\.DS_Store)"
GUARDED_PATHS = r"(scripts/agent/|\.claude/|docs/spec/)"
WRITE_OPS = r"(sed\s+-i|>{1,2}\s*\S|\btee\b|\bcp\b|\bmv\b|\brm\b|python3?\s|\bperl\b|\btouch\b|\bgit\s+(rm|mv)\b|\bchmod\b)"
OWN_SCRIPTS = r'^("?\$CLAUDE_PROJECT_DIR"?/)?(\./)?(python3?\s+)?("?\$CLAUDE_PROJECT_DIR"?/)?scripts/agent/' \
              r'(milestone-check|advance|session-brief)\.py\b'


def strip_heredocs(cmd: str) -> str:
    """Remove heredoc bodies (<<EOF ... EOF) so only the command line itself is judged."""
    out = []
    lines = cmd.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.search(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?", line)
        out.append(line)
        i += 1
        if m:
            term = m.group(1)
            while i < len(lines) and lines[i].strip() != term:
                i += 1
            i += 1  # skip the terminator
    return "\n".join(out)


def redirect_targets(c: str) -> list[str]:
    targets = re.findall(r"(?<![<>])>{1,2}\s*([^\s;&|)]+)", c)
    targets += re.findall(r"\btee\s+(?:-a\s+)?([^\s;&|]+)", c)
    return [t.strip("'\"") for t in targets if not t.startswith(("/dev/", "&"))]


def main() -> None:
    data = read_input()
    raw = (data.get("tool_input", {}) or {}).get("command", "") or ""
    c = " ".join(strip_heredocs(raw).split())
    stripped = c.lstrip('"').lstrip()

    if re.search(r"\bgit\s+push\b", c) and re.search(r"(\bmain\b|--force\b|\s-f\b|--delete\b|\s\+\S)", c):
        deny_pre("git push to main, force pushes and ref deletion are owner actions. Push the integration "
                 "branch only: git push origin mvp/daily-use.")
    if re.search(r"\bgh\s+pr\s+merge\b", c) or re.search(r"\bgit\s+merge\b.*\bmain\b", c):
        deny_pre("Merging is the owner's decision. Prepare the branch and the report; do not merge.")
    if re.search(r"\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f|\bgit\s+checkout\s+--\s+\.|\bgit\s+restore\s+\.\s*$", c):
        deny_pre("Destructive git working-tree commands are blocked. Revert a specific file with "
                 "`git checkout -- <file>` or ask the owner.")
    for m in re.finditer(r"(?<!git )\brm\s+(-[a-zA-Z]*r[a-zA-Z]*|--recursive)\b([^;&|]*)", c):
        targets = [t for t in m.group(2).split() if t and not t.startswith("-")]
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
    if re.search(r"(playwright\s+test|npm\s+run\s+e2e|npx\s+playwright\s+test)", c) and "E2E_BASE_URL=" not in c \
            and "make web-e2e-local" not in c:
        deny_pre("Playwright needs an explicit E2E_BASE_URL (a local backend). Use `make web-e2e-local` or "
                 "prefix the command with E2E_BASE_URL=http://127.0.0.1:8000. Never the live site.")
    if "getrendercheck.com" in c and re.search(r"(playwright|e2e|curl\s+-X\s+(POST|PATCH|DELETE)|--data)", c):
        deny_pre("The live site is production. Do not run journeys or writes against it.")
    if re.search(r"\b(dropdb|DROP\s+DATABASE)\b", c, re.I) and not re.search(r"journal_(test|verify_)", c):
        deny_pre("Only the test databases (journal_test, journal_verify_*) may be dropped.")
    if re.search(r"\balembic\s+downgrade\b", c):
        deny_pre("alembic downgrade is an owner action. Migrations are additive; write a new migration instead.")
    if re.search(r"\b(python3?|uv\s+run(\s+python3?)?)\s+\S*eval_provider\.py\b", c) \
            and "JOURNAL_EVAL_AUTHORIZED=1" not in c:
        deny_pre("Real-provider evaluation spends the owner's money. It runs only when the owner authorizes it, "
                 "with JOURNAL_EVAL_AUTHORIZED=1 on the command line.")
    if re.search(r"\b(curl|wget|http|https)\b", c) and re.search(PROVIDER_HOSTS, c):
        deny_pre("Ad-hoc calls to AI providers are blocked (they cost money and bypass the usage ledger). "
                 "Use the mocked tests, or the authorized eval script.")
    if "assembleRelease" in c and "JOURNAL_ANDROID_TEST_CLEARTEXT" in c:
        deny_pre("A release build must never allow cleartext HTTP.")

    if override_active():
        return
    if re.search(GUARDED_PATHS, c) and re.search(WRITE_OPS, c) and not re.match(OWN_SCRIPTS, stripped):
        deny_pre("Shell writes to scripts/agent/, .claude/ or docs/spec/ are blocked; those are owner-controlled. "
                 "Milestones advance through scripts/agent/advance.py. The owner can `touch .claude/agent-override`.")
    scope, name, milestone = active()
    for target in redirect_targets(c):
        path = rel(target)
        if path is None:
            continue
        if matches(path, scope["never"]) or not in_scope(path, scope, milestone):
            deny_pre(f"Redirecting output into '{path}' is outside the active milestone {name} scope (or frozen). "
                     "Use the Edit/Write tools for in-scope files; record other needs under 'Parked'.")


if __name__ == "__main__":
    main()
