"""Policy enforcement (review R4): admission, change-set checks and trusted approvals.

The fixture repo carries a minimal policy at its base commit. Approvals are committed to the base the same
way an owner would record them. Pending entries must never authorize anything, and a candidate must never
approve itself."""

from __future__ import annotations

import json
import shutil
import subprocess
import unittest

from factory import state
from factory.common import FactoryError
from factory.controller import Controller
from factory.policy_gate import (
    APPROVALS_PATH,
    approved_prefixes,
    change_violations,
    parse_policy,
    ticket_authorization_problems,
)
from factory.tests.test_factory import IDENTITY, PROJECT, Fixture, ScriptedAdapter, make_ticket

APPROVE = {"decision": "approve", "checked_acceptance": ["AC-1"], "findings": []}
FIXTURE_POLICY = parse_policy(
    'allowed_globs := [\n"app/**",\n"docs/**",\n]\nprotected_globs := [\n"policy/**",\n"factory/**",\n]\n'
)


def approvals(entries: list[dict]) -> str:
    return json.dumps({"_status": "test", "exceptions": entries}, indent=2)


class ApprovalTrust(Fixture):
    def commit_approvals(self, text: str) -> None:
        path = self.repo / APPROVALS_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        self._git("add", APPROVALS_PATH)
        self._git(*IDENTITY, "commit", "-q", "-m", "owner approval record")

    def test_pending_entry_authorizes_nothing(self):
        self.commit_approvals(approvals([{"prefix": "web/", "status": "pending-owner-approval", "reason": "x"}]))
        self.assertEqual(approved_prefixes(self.repo, "HEAD"), ())

    def test_approved_entry_without_a_named_approver_authorizes_nothing(self):
        self.commit_approvals(approvals([{"prefix": "web/", "status": "approved", "approved_by": "  "}]))
        self.assertEqual(approved_prefixes(self.repo, "HEAD"), ())

    def test_approved_entry_with_a_named_approver_authorizes_its_prefix(self):
        self.commit_approvals(approvals([{"prefix": "web/src/", "status": "approved", "approved_by": "owner"}]))
        self.assertEqual(approved_prefixes(self.repo, "HEAD"), ("web/src/",))

    def test_ticket_outside_policy_is_refused_before_any_worktree_exists(self):
        self.commit_approvals(approvals([{"prefix": "web/", "status": "pending-owner-approval"}]))
        ticket = make_ticket(allowed_paths=["web/src/**"])
        controller = Controller(self.repo, self.ledger, ScriptedAdapter([], []), {**_config(), "providers": {}}, PROJECT, "hash-1")
        with self.assertRaises(FactoryError) as ctx:
            controller.run(ticket)
        self.assertIn("not authorized by policy", str(ctx.exception))
        self.assertIn("a pending exception does not authorize work", str(ctx.exception))
        self.assertEqual(self.ledger._conn.execute("select count(*) from runs").fetchone()[0], 0)
        self.assertFalse((self.repo / ".factory-local" / "workspaces").exists() and any((self.repo / ".factory-local" / "workspaces").iterdir()))

    def test_approved_exception_admits_the_ticket_and_the_run_completes(self):
        self.commit_approvals(approvals([{"prefix": "web/", "status": "approved", "approved_by": "owner"}]))
        ticket = make_ticket(allowed_paths=["web/src/**"], verification=["no-broken-marker"])
        adapter = ScriptedAdapter([{"files": {"web/src/a.ts": "export const a = 1;\n"}}], [APPROVE])
        controller = Controller(self.repo, self.ledger, adapter, _config(), PROJECT, "hash-1")
        run_id = controller.run(ticket)
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.READY)

    def test_plan_states_that_pending_work_is_review_preparation_only(self):
        self.commit_approvals(approvals([{"prefix": "web/", "status": "pending-owner-approval"}]))
        controller = Controller(self.repo, self.ledger, ScriptedAdapter([], []), _config(), PROJECT, "hash-1")
        plan = controller.plan(make_ticket(allowed_paths=["web/src/**"]))
        self.assertFalse(plan["authorized_by_policy"])
        self.assertIn("review preparation only", plan["status"])


class SelfApproval(Fixture):
    def test_candidate_that_edits_the_approvals_file_is_refused(self):
        # The ticket is admitted by the base policy. The candidate then tries to approve itself.
        adapter = ScriptedAdapter(
            [{"files": {
                "app/feature.txt": "good\n",
                APPROVALS_PATH: approvals([{"prefix": "secret/", "status": "approved", "approved_by": "candidate"}]),
            }}],
            [APPROVE],
        )
        controller = Controller(self.repo, self.ledger, adapter, _config(), PROJECT, "hash-1")
        run_id = controller.run(make_ticket())
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn(f"protected path changed: {APPROVALS_PATH}", run["stop_reason"])


class ChangeSetMatrix(unittest.TestCase):
    def test_protected_paths_are_refused_even_when_an_approval_names_them(self):
        violations = change_violations(["factory/controller/core.py"], FIXTURE_POLICY, ("factory/",))
        self.assertEqual(violations, ["policy: protected path changed: factory/controller/core.py"])

    def test_allowed_roots_pass_without_approval(self):
        self.assertEqual(change_violations(["app/x.ts", "docs/notes.md"], FIXTURE_POLICY, ()), [])

    def test_paths_outside_roots_need_an_approved_prefix(self):
        violations = change_violations(["web/src/a.ts"], FIXTURE_POLICY, ())
        self.assertEqual(len(violations), 1)
        self.assertIn("not authorized", violations[0])
        self.assertEqual(change_violations(["web/src/a.ts"], FIXTURE_POLICY, ("web/src/",)), [])

    def test_ticket_path_check_uses_the_same_rule(self):
        self.assertEqual(ticket_authorization_problems(["app/**"], FIXTURE_POLICY, ()), [])
        self.assertTrue(ticket_authorization_problems(["web/src/**"], FIXTURE_POLICY, ()))


def _config() -> dict:
    from factory.tests.test_factory import CONFIG

    return CONFIG


if __name__ == "__main__":
    unittest.main()
