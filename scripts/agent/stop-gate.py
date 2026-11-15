#!/usr/bin/env python3
"""Stop hook: refuse to stop with out-of-scope changes or a failing gate. Reminds about the milestone log."""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import active, changed_files, in_scope, override_active, read_input, root, tree_key  # noqa: E402

GATE_OK = ".git/journal-gate-ok"
SOURCE_PREFIXES = ("web/", "backend/", "docker/", "ops/", "scripts/", ".github/", "Makefile")
EXEMPT = {"scripts/agent/scope.json"}


def block(reason: str) -> None:
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


def main() -> None:
    data = read_input()
    if data.get("stop_hook_active"):
        return
    files = changed_files()
    if not files:
        return
    scope, name, milestone = active()
    messages: list[str] = []

    if not override_active():
        outside = [f for f in files if f not in EXEMPT and not in_scope(f, scope, milestone)
                   and (root() / f).exists()]
        if outside:
            block(f"Changes outside the active milestone {name} scope: {outside}. Revert them (git checkout -- "
                  "<file>, or delete new files) or move the need to 'Parked' in docs/milestones.md. "
                  "Then run `make gate` and stop again.")

    source_changed = any(f.startswith(SOURCE_PREFIXES) for f in files)
    if source_changed:
        key = tree_key()
        cache = root() / GATE_OK
        if not (cache.exists() and cache.read_text().strip() == key):
            proc = subprocess.run(["./scripts/gate.sh", "--fast"], cwd=root(), capture_output=True, text=True)
            out = proc.stdout + proc.stderr
            if "GATE_PG_UNAVAILABLE=1" in out:
                messages.append("Backend tests were skipped: PostgreSQL on 5433 is not reachable. Start it before "
                                "the next gate.")
            if proc.returncode != 0:
                tail = "\n".join(out.splitlines()[-40:])
                block("The quality gate failed. Fix it before stopping (or, if the failure needs an owner action, "
                      "record it under 'Owner actions needed' in docs/milestones.md and say so in your report).\n"
                      + tail)
            cache.write_text(key)
        if "docs/milestones.md" not in files:
            messages.append("Source changed but docs/milestones.md was not updated: tick the task or add an "
                            "evidence line before you report.")
    if messages:
        print(json.dumps({"systemMessage": " ".join(messages)}))


if __name__ == "__main__":
    main()
