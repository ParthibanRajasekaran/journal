#!/usr/bin/env python3
"""SessionStart hook: record the session base commit and brief the agent on the active milestone."""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SESSION_BASE, active, git, root  # noqa: E402


def milestone_section(name: str) -> str:
    text = (root() / "docs" / "milestones.md").read_text(encoding="utf-8")
    m = re.search(rf"^## {name}\b.*?(?=^## M\d|\Z)", text, re.S | re.M)
    return m.group(0) if m else ""


def unchecked(section: str, heading: str, limit: int) -> list[str]:
    m = re.search(rf"^### {heading}\n(.*?)(?=^### |\Z)", section, re.S | re.M)
    if not m:
        return []
    items = [line.strip() for line in m.group(1).splitlines() if line.strip().startswith("- [ ]")]
    return items[:limit]


def main() -> None:
    head = git("rev-parse", "HEAD").strip()
    (root() / SESSION_BASE).write_text(head + "\n")
    scope, name, milestone = active()
    section = milestone_section(name)
    branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    status = git("status", "--short").splitlines()[:20]
    lines = [
        f"Journal agent brief. Branch {branch} at {head[:10]}. Active milestone: {name} ({milestone.get('title', '')}).",
        "Uncommitted: " + (", ".join(s.strip() for s in status) if status else "clean") + ".",
        "Next tasks:",
        *[f"  {t}" for t in unchecked(section, "Tasks", 5)] or ["  (none unchecked)"],
        "Open exit criteria:",
        *[f"  {t}" for t in unchecked(section, "Exit criteria", 8)] or ["  (none)"],
        "Rules: edit only paths in scripts/agent/scope.json for this milestone; run `make gate` before stopping; "
        "tick tasks and log evidence in docs/milestones.md; commit as 'M<n>: ...' on this branch; ask only for owner "
        "account, deployment, merge or spend decisions. Read CLAUDE.md and docs/milestones.md first.",
    ]
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "\n".join(lines)}}))


if __name__ == "__main__":
    main()
