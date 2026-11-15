"""Shared helpers for the Claude Code hooks in this directory. Standard library only."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def root() -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env:
        return Path(env).resolve()
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
        ).stdout.strip()
        return Path(out).resolve()
    except Exception:  # noqa: BLE001
        return Path.cwd().resolve()


def read_input() -> dict:
    try:
        data = json.load(sys.stdin)
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def load_scope() -> dict:
    with (root() / "scripts" / "agent" / "scope.json").open() as fh:
        return json.load(fh)


def active(scope: dict | None = None) -> tuple[dict, str, dict]:
    scope = scope or load_scope()
    name = scope["active"]
    return scope, name, scope["milestones"][name]


def glob_re(pattern: str) -> re.Pattern[str]:
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
        elif pattern.startswith("**", i):
            out += ".*"
            i += 2
        elif pattern[i] == "*":
            out += "[^/]*"
            i += 1
        elif pattern[i] == "?":
            out += "[^/]"
            i += 1
        else:
            out += re.escape(pattern[i])
            i += 1
    return re.compile("^" + out + "$")


def matches(path: str, patterns: list[str]) -> bool:
    return any(glob_re(p).match(path) for p in patterns)


def rel(path_str: str) -> str | None:
    """Repo-relative POSIX path, or None when the path is outside the repository."""
    p = Path(path_str)
    if not p.is_absolute():
        p = Path.cwd() / p
    try:
        return p.resolve().relative_to(root()).as_posix()
    except ValueError:
        return None


def override_active() -> bool:
    """The owner can `touch .claude/agent-override` to lift the scope rules for a session."""
    return (root() / ".claude" / "agent-override").exists()


def in_scope(path: str, scope: dict, milestone: dict) -> bool:
    return matches(path, scope["always"]) or matches(path, milestone["paths"])


def git(*args: str) -> str:
    try:
        return subprocess.run(
            ["git", *args], cwd=root(), capture_output=True, text=True, check=False
        ).stdout
    except Exception:  # noqa: BLE001
        return ""


SESSION_BASE = ".git/journal-session-base"


def session_base() -> str | None:
    p = root() / SESSION_BASE
    return p.read_text().strip() if p.exists() else None


def changed_files() -> list[str]:
    """Files touched since the session started (commits after the recorded base) plus the working tree."""
    files: set[str] = set()
    base = session_base()
    head = git("rev-parse", "HEAD").strip()
    if base and base != head and git("merge-base", "--is-ancestor", base, head) == "" and \
            subprocess.run(["git", "merge-base", "--is-ancestor", base, head], cwd=root()).returncode == 0:
        files.update(l for l in git("diff", "--name-only", base, head).splitlines() if l)
    for line in git("status", "--porcelain", "--untracked-files=all").splitlines():
        if len(line) > 3:
            path = line[3:]
            if " -> " in path:
                path = path.split(" -> ", 1)[1]
            files.add(path.strip().strip('"'))
    return sorted(files)


def tree_key() -> str:
    """Fingerprint of HEAD plus every uncommitted change, used to skip a gate that already passed."""
    h = hashlib.sha256()
    h.update(git("rev-parse", "HEAD").encode())
    h.update(git("diff", "HEAD").encode())
    for path in git("ls-files", "--others", "--exclude-standard").splitlines():
        p = root() / path
        if p.is_file():
            h.update(path.encode())
            try:
                h.update(p.read_bytes())
            except OSError:
                pass
    return h.hexdigest()


def deny_pre(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)
