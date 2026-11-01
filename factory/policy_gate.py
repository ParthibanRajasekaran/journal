"""Change-set policy enforcement for factory work (review R4).

Authorization is decided here, in code, from trusted inputs:

- The policy's allowed roots and protected globs come from policy/agents/change_policy.rego at the
  BASE commit of the run, not from the candidate worktree.
- Approvals come from docs/factory/policy-exceptions.json at the base commit. Only entries with
  status "approved" and a named approver authorize anything. A "pending-owner-approval" entry
  authorizes nothing, so a pending exception cannot authorize itself.
- The approvals file is protected in the project, so a candidate cannot add an approval in its diff.

This is an admission and change-set check, not process containment. It does not stop a tool from
reading or writing outside the worktree.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from factory import gitops
from factory.common import FactoryError
from factory.scope import matches

POLICY_PATH = "policy/agents/change_policy.rego"
APPROVALS_PATH = "docs/factory/policy-exceptions.json"


@dataclass(frozen=True)
class PolicyLists:
    allowed: tuple[str, ...]
    protected: tuple[str, ...]


def parse_policy(text: str) -> PolicyLists:
    def block(name: str) -> tuple[str, ...]:
        found = re.search(rf"{name}\s*:=\s*\[(.*?)\]", text, flags=re.DOTALL)
        if found is None:
            raise FactoryError(f"{name} is missing from {POLICY_PATH}")
        return tuple(re.findall(r'"([^"]+)"', found.group(1)))

    return PolicyLists(allowed=block("allowed_globs"), protected=block("protected_globs"))


def static_prefix(pattern: str) -> str:
    """The part of a glob before its first wildcard: 'web/src/a.ts' stays whole, 'web/**' becomes 'web/'."""
    found = re.search(r"[*?]", pattern)
    return pattern if found is None else pattern[: found.start()]


def read_at(repo: Path, ref: str, path: str) -> str | None:
    """The content of a file at a commit, or None if the file does not exist there."""
    try:
        return gitops.git(repo, "show", f"{ref}:{path}")
    except FactoryError:
        return None


def load_policy_at(repo: Path, ref: str) -> PolicyLists:
    text = read_at(repo, ref, POLICY_PATH)
    if text is None:
        raise FactoryError(f"{POLICY_PATH} does not exist at {ref[:12]}; the policy cannot be applied")
    return parse_policy(text)


def approved_prefixes(repo: Path, ref: str) -> tuple[str, ...]:
    """Prefixes approved by the owner at this commit. Anything not status 'approved' with a named approver is ignored."""
    text = read_at(repo, ref, APPROVALS_PATH)
    if text is None:
        return ()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise FactoryError(f"{APPROVALS_PATH} is not valid JSON at {ref[:12]}") from exc
    prefixes = []
    for entry in data.get("exceptions", []):
        if entry.get("status") == "approved" and isinstance(entry.get("approved_by"), str) and entry["approved_by"].strip():
            if isinstance(entry.get("prefix"), str):
                prefixes.append(entry["prefix"])
    return tuple(prefixes)


def pattern_authorized(pattern: str, policy: PolicyLists, approved: tuple[str, ...]) -> bool:
    prefix = static_prefix(pattern)
    roots = [static_prefix(g) for g in policy.allowed]
    return any(prefix.startswith(root) for root in roots) or any(prefix.startswith(p) for p in approved)


def ticket_authorization_problems(ticket_paths: list[str], policy: PolicyLists, approved: tuple[str, ...]) -> list[str]:
    return [
        f"ticket path {p} is outside the policy's allowed roots and has no approved exception "
        f"(a pending exception does not authorize work; the owner records approval in {APPROVALS_PATH})"
        for p in ticket_paths
        if not pattern_authorized(p, policy, approved)
    ]


def change_violations(changed: list[str], policy: PolicyLists, approved: tuple[str, ...]) -> list[str]:
    """Violations for a change set. Protected paths are refused even when also allowed or approved.

    The approvals file is always protected here, whatever a project file says, so a change set can never
    add its own approval."""
    problems = []
    for path in changed:
        if path == APPROVALS_PATH or matches(path, list(policy.protected)):
            problems.append(f"policy: protected path changed: {path}")
            continue
        in_roots = matches(path, list(policy.allowed))
        in_exception = any(path.startswith(p) for p in approved)
        if not (in_roots or in_exception):
            problems.append(f"policy: not authorized by the allowed roots or an approved exception: {path}")
    return problems


def changed_between(repo: Path, base: str, head: str) -> list[str]:
    out = gitops.git(repo, "diff", "--name-only", "--no-renames", f"{base}..{head}")
    return [line for line in out.splitlines() if line]
