"""Keeps the factory's scope rules and the agent change policy (policy/agents/change_policy.rego) in
agreement, without editing the policy. The policy is human-review-only, so these tests read it and
report drift. They do not change it.

Rules tested:
1. Every protected glob in the agent policy is also protected by the factory. The factory may protect
   more, never less.
2. Every ticket path the factory allows is either inside the policy's allowed roots, or covered by a
   declared exception in docs/factory/policy-exceptions.json that is still pending owner approval.
3. No exception is stale. An exception nothing uses must be removed.
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
POLICY = REPO / "policy" / "agents" / "change_policy.rego"
EXCEPTIONS = REPO / "docs" / "factory" / "policy-exceptions.json"
PROJECT = REPO / "factory" / "projects" / "journal.json"
TICKETS = REPO / "factory" / "tickets"


def rego_list(text: str, name: str) -> list[str]:
    block = re.search(rf"{name}\s*:=\s*\[(.*?)\]", text, flags=re.DOTALL)
    if block is None:
        raise AssertionError(f"{name} not found in the agent policy")
    return re.findall(r'"([^"]+)"', block.group(1))


def static_prefix(pattern: str) -> str:
    """The part of a glob before its first wildcard. 'web/src/a.ts' -> itself; 'src/**' -> 'src/'."""
    match = re.search(r"[*?]", pattern)
    return pattern if match is None else pattern[: match.start()]


class PolicyAlignment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        text = POLICY.read_text(encoding="utf-8")
        cls.policy_allowed = rego_list(text, "allowed_globs")
        cls.policy_protected = rego_list(text, "protected_globs")
        cls.factory_protected = json.loads(PROJECT.read_text())["protected_paths"]
        cls.exceptions = json.loads(EXCEPTIONS.read_text())

    def test_the_policy_lists_are_readable(self):
        self.assertEqual(sorted(self.policy_allowed), sorted(["src/**", "backend/**", "tests/**", "docs/**"]))
        self.assertIn("policy/**", self.policy_protected)
        self.assertIn("**/auth/**", self.policy_protected)

    def test_every_policy_protected_path_is_also_protected_by_the_factory(self):
        missing = [g for g in self.policy_protected if g not in self.factory_protected]
        self.assertEqual(missing, [], "the factory must protect at least what the agent policy protects")

    def test_exceptions_are_pending_owner_approval(self):
        self.assertEqual(self.exceptions["_status"], "pending-owner-approval")

    def test_every_ticket_path_is_inside_policy_roots_or_a_declared_exception(self):
        root_prefixes = [static_prefix(g) for g in self.policy_allowed]
        exception_prefixes = [e["prefix"] for e in self.exceptions["exceptions"]]
        uncovered = []
        for ticket_file in sorted(TICKETS.glob("*.json")):
            ticket = json.loads(ticket_file.read_text())
            for pattern in ticket["allowed_paths"]:
                prefix = static_prefix(pattern)
                in_roots = any(prefix.startswith(root) for root in root_prefixes)
                in_exception = any(prefix.startswith(ex) for ex in exception_prefixes)
                if not (in_roots or in_exception):
                    uncovered.append(f"{ticket_file.name}: {pattern}")
        self.assertEqual(uncovered, [], "policy drift: add an owner-reviewed exception or narrow the ticket")

    def test_no_exception_is_stale(self):
        used_prefixes = set()
        for ticket_file in TICKETS.glob("*.json"):
            ticket = json.loads(ticket_file.read_text())
            for pattern in ticket["allowed_paths"]:
                used_prefixes.add(static_prefix(pattern))
        for exception in self.exceptions["exceptions"]:
            with self.subTest(prefix=exception["prefix"]):
                self.assertTrue(
                    any(p.startswith(exception["prefix"]) for p in used_prefixes),
                    "exception no ticket uses; remove it",
                )


if __name__ == "__main__":
    unittest.main()
