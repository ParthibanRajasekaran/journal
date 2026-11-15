#!/usr/bin/env python3
"""PreToolUse hook for Edit, Write and NotebookEdit: scope, frozen files, secrets, milestone rules."""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import active, deny_pre, in_scope, matches, override_active, read_input, rel  # noqa: E402

SECRET_PATTERNS = [
    (r"sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}", "an OpenAI or Anthropic style API key"),
    (r"AIza[0-9A-Za-z_-]{30,}", "a Google API key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "a private key"),
    (r"ghp_[A-Za-z0-9]{30,}", "a GitHub token"),
]


def main() -> None:
    data = read_input()
    tool_input = data.get("tool_input", {}) or {}
    file_path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not file_path:
        return
    path = rel(file_path)
    if path is None:
        return  # outside the repository (plan files, scratchpad): not our concern
    content = tool_input.get("content") or tool_input.get("new_string") or tool_input.get("new_source") or ""

    for pattern, label in SECRET_PATTERNS:
        if re.search(pattern, content):
            deny_pre(f"The new content looks like it contains {label}. Secrets never go into the repository; "
                     "use environment variables and backend/.env (ignored by git).")

    if path == "backend/app/config.py" and re.search(r"(openai|anthropic|gemini)_api_key", content, re.I):
        deny_pre("No developer-funded AI key: Settings must not gain a provider API key. Estimates use the "
                 "user's own stored key only (docs/spec/00-review-and-handoff.md section 5).")

    scope, name, milestone = active()
    if not override_active():
        if matches(path, scope["never"]):
            deny_pre(f"'{path}' is frozen for agents (the 'never' list in scripts/agent/scope.json). Only the owner "
                     "changes it. Ask, or the owner can run `touch .claude/agent-override` for one session.")
        if not in_scope(path, scope, milestone):
            deny_pre(f"'{path}' is outside the active milestone {name} ({milestone.get('title', '')}). Allowed: the "
                     f"'always' list plus {milestone['paths']}. If the change is really needed, record it under "
                     "'Parked' in docs/milestones.md and continue with in-scope work. The owner advances milestones "
                     "with scripts/agent/advance.py.")

    rules = milestone.get("rules", [])
    if ("no-raw-localstorage" in rules and path.startswith("web/src/")
            and not path.startswith("web/src/storage/") and not path.endswith((".test.ts", ".test.tsx"))
            and re.search(r"\b(localStorage|sessionStorage)\.", content)):
        deny_pre("Rule no-raw-localstorage: from M1 on, browser storage is only touched inside web/src/storage/ "
                 "(the transactional repository). Use the repository API instead, or narrow the edit so the "
                 "new text does not include a raw localStorage/sessionStorage call.")


if __name__ == "__main__":
    main()
