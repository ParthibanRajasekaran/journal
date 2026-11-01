"""Change-set policy check for CI (bootstrap, stdlib only).

Judges a diff between two refs against policy/agents/change_policy.rego and the owner approvals, both read at
the BASE commit. The pull request is read as data through git; its code is never imported.

Rules (must match factory/policy_gate.py on the review branch; a cross-check test there keeps them in step):
- A protected path is refused even if allowed or approved.
- docs/factory/policy-exceptions.json is always protected, so a change set cannot approve itself.
- Any other path must lie inside the policy's allowed roots, or under an entry with status "approved" and a
  non-empty approved_by. Entries with other statuses authorize nothing.

Exit status: 0 when there are no violations, 2 when there are, 1 for an operator error.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from functools import lru_cache

POLICY_PATH = "policy/agents/change_policy.rego"
APPROVALS_PATH = "docs/factory/policy-exceptions.json"


class CheckError(Exception):
    pass


def git(repo: str, *args: str) -> str:
    proc = subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)
    if proc.returncode != 0:
        raise CheckError(f"git {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def read_at(repo: str, ref: str, path: str) -> str | None:
    try:
        return git(repo, "show", f"{ref}:{path}")
    except CheckError:
        return None


@dataclass(frozen=True)
class Policy:
    allowed: tuple[str, ...]
    protected: tuple[str, ...]


def parse_policy(text: str) -> Policy:
    def block(name: str) -> tuple[str, ...]:
        found = re.search(rf"{name}\s*:=\s*\[(.*?)\]", text, flags=re.DOTALL)
        if found is None:
            raise CheckError(f"{name} is missing from {POLICY_PATH}")
        return tuple(re.findall(r'"([^"]+)"', found.group(1)))

    return Policy(allowed=block("allowed_globs"), protected=block("protected_globs"))


@lru_cache(maxsize=256)
def _regex(pattern: str) -> re.Pattern[str]:
    out, i = [], 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
            continue
        if pattern.startswith("**", i):
            out.append(".*")
            i += 2
            continue
        ch = pattern[i]
        out.append("[^/]*" if ch == "*" else "[^/]" if ch == "?" else re.escape(ch))
        i += 1
    return re.compile("^" + "".join(out) + "$")


def matches(path: str, patterns: tuple[str, ...]) -> bool:
    return any(_regex(p).match(path) for p in patterns)


def static_prefix(pattern: str) -> str:
    found = re.search(r"[*?]", pattern)
    return pattern if found is None else pattern[: found.start()]


def approved_prefixes(repo: str, ref: str) -> tuple[str, ...]:
    text = read_at(repo, ref, APPROVALS_PATH)
    if text is None:
        return ()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise CheckError(f"{APPROVALS_PATH} is not valid JSON at {ref[:12]}") from exc
    out = []
    for entry in data.get("exceptions", []):
        if (
            entry.get("status") == "approved"
            and isinstance(entry.get("approved_by"), str)
            and entry["approved_by"].strip()
            and isinstance(entry.get("prefix"), str)
        ):
            out.append(entry["prefix"])
    return tuple(out)


def change_violations(changed: list[str], policy: Policy, approved: tuple[str, ...]) -> list[str]:
    problems = []
    for path in changed:
        if path == APPROVALS_PATH or matches(path, policy.protected):
            problems.append(f"policy: protected path changed: {path}")
            continue
        if not (matches(path, policy.allowed) or any(path.startswith(p) for p in approved)):
            problems.append(f"policy: not authorized by the allowed roots or an approved exception: {path}")
    return problems


def check(repo: str, base: str, head: str) -> list[str]:
    base_sha = git(repo, "rev-parse", "--verify", f"{base}^{{commit}}").strip()
    head_sha = git(repo, "rev-parse", "--verify", f"{head}^{{commit}}").strip()
    policy_text = read_at(repo, base_sha, POLICY_PATH)
    if policy_text is None:
        raise CheckError(f"{POLICY_PATH} does not exist at the base commit; nothing can be judged")
    changed = [p for p in git(repo, "diff", "--name-only", "--no-renames", f"{base_sha}..{head_sha}").splitlines() if p]
    return change_violations(changed, parse_policy(policy_text), approved_prefixes(repo, base_sha))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="policy_check", description="Change-set policy check for CI")
    parser.add_argument("--repo", required=True, help="checkout holding the pull request, read as data")
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    args = parser.parse_args(argv)
    try:
        violations = check(args.repo, args.base, args.head)
    except CheckError as exc:
        print(f"policy_check: {exc}", file=sys.stderr)
        return 1
    for v in violations:
        print(v)
    print("passed" if not violations else f"failed: {len(violations)} violation(s)")
    return 0 if not violations else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
