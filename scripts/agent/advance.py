#!/usr/bin/env python3
"""Advance the active milestone. The only sanctioned way to change scripts/agent/scope.json.

Usage: scripts/agent/advance.py M<n>
Refuses unless the current milestone's automated checks pass and every manual criterion is ticked in
docs/milestones.md. The owner ticks manual criteria after recording evidence.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import active, root  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"M[0-5]", sys.argv[1].upper()):
        sys.exit("usage: advance.py M<n>")
    target = sys.argv[1].upper()
    scope, current, _ = active()
    order = list(scope["milestones"])
    if order.index(target) != order.index(current) + 1:
        sys.exit(f"Active is {current}; the next milestone is {order[order.index(current) + 1] if current != order[-1] else 'none'}.")
    text = (root() / "docs" / "milestones.md").read_text(encoding="utf-8")
    sec = re.search(rf"^## {current}\b.*?(?=^## M\d|\Z)", text, re.S | re.M)
    crit = re.search(r"^### Exit criteria\n(.*?)(?=^### |\Z)", sec.group(0) if sec else "", re.S | re.M)
    open_manual = [l.strip() for l in (crit.group(1) if crit else "").splitlines()
                   if l.strip().startswith("- [ ]") and "manual" in l.lower()]
    if open_manual:
        sys.exit("Manual exit criteria still open for " + current + ":\n  " + "\n  ".join(open_manual)
                 + "\nRecord the evidence in docs/milestones.md and tick them (owner).")
    proc = subprocess.run([sys.executable, str(Path(__file__).with_name("milestone-check.py")), current], cwd=root())
    if proc.returncode != 0:
        sys.exit(f"Automated checks for {current} failed; not advancing.")
    scope["active"] = target
    (root() / "scripts" / "agent" / "scope.json").write_text(json.dumps(scope, indent=2) + "\n")
    print(f"Active milestone is now {target}. Commit scripts/agent/scope.json with the evidence update.")


if __name__ == "__main__":
    main()
