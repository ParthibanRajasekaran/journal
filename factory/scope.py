"""Path scope checks. Allowed and protected patterns use '**' for any depth, as in .gitignore-like globs."""

from __future__ import annotations

import re
from functools import lru_cache


@lru_cache(maxsize=256)
def _regex(pattern: str) -> re.Pattern[str]:
    out = []
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
            continue
        if pattern.startswith("**", i):
            out.append(".*")
            i += 2
            continue
        if ch == "*":
            out.append("[^/]*")
        elif ch == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(ch))
        i += 1
    return re.compile("^" + "".join(out) + "$")


def matches(path: str, patterns: list[str]) -> bool:
    return any(_regex(p).match(path) for p in patterns)


def check_scope(changed: list[str], allowed: list[str], protected: list[str]) -> list[str]:
    """Returns one message per violation. Protected paths are refused even when also allowed."""
    problems = []
    for path in changed:
        if matches(path, protected):
            problems.append(f"protected path changed: {path}")
        elif not matches(path, allowed):
            problems.append(f"outside the ticket's allowed paths: {path}")
    return problems
