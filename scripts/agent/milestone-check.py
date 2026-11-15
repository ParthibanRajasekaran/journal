#!/usr/bin/env python3
"""Run the automated checks for a milestone and print every exit criterion with its state.

Usage: scripts/agent/milestone-check.py [M<n>]   (defaults to the active milestone)
Exit 0 when all automated checks pass; 1 otherwise. Manual criteria are reported, never judged.
"""

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import active, root  # noqa: E402


def section(name: str) -> str:
    text = (root() / "docs" / "milestones.md").read_text(encoding="utf-8")
    m = re.search(rf"^## {name}\b.*?(?=^## M\d|\Z)", text, re.S | re.M)
    return m.group(0) if m else ""


def criteria(sec: str) -> list[tuple[bool, str]]:
    m = re.search(r"^### Exit criteria\n(.*?)(?=^### |\Z)", sec, re.S | re.M)
    out = []
    for line in (m.group(1) if m else "").splitlines():
        s = line.strip()
        if s.startswith("- [x]") or s.startswith("- [ ]"):
            out.append((s.startswith("- [x]"), s[5:].strip()))
    return out


def run(label: str, cmd: list[str], cwd: Path) -> bool:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    out = proc.stdout + proc.stderr
    ok = proc.returncode == 0 or ("no tests ran" in out.lower() and "error" not in out.lower()) \
        or "No test files found" in out
    print(("ok    " if ok else "FAIL  ") + label)
    if not ok:
        print("\n".join("      " + l for l in out.splitlines()[-25:]))
    return ok


def main() -> None:
    _, current, _ = active()
    name = sys.argv[1].upper() if len(sys.argv) > 1 else current
    marker = name.lower()
    ok = run(f"backend pytest -m {marker}", ["uv", "run", "pytest", "-q", "-m", marker, "-p", "no:cacheprovider"],
             root() / "backend")
    ok = run(f"web vitest -t [{name}]", ["npx", "vitest", "run", "--silent", "-t", f"\\[{name}\\]"], root() / "web") and ok
    print(f"\nExit criteria for {name}:")
    for ticked, text in criteria(section(name)):
        kind = "auto" if text.lower().startswith("auto") else "manual"
        state = "ticked" if ticked else ("pending owner evidence" if kind == "manual" else "open")
        print(f"  [{'x' if ticked else ' '}] {kind:6} {state:22} {text}")
    print("\nAUTOMATED CHECKS " + ("PASSED" if ok else "FAILED"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
