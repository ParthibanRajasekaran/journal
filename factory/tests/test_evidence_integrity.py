"""Evidence must describe the exact committed candidate. Each test here breaks one condition and checks
that the factory blocks, rather than reporting a commit as verified."""

from __future__ import annotations

import json
import subprocess
import sys

from factory import state
from factory.common import FactoryError
from factory.controller import Controller
from factory.tests.test_factory import IDENTITY, PROJECT, Fixture, ScriptedAdapter, make_ticket

APPROVE = {"decision": "approve", "checked_acceptance": ["AC-1"], "findings": []}


class EvidenceIntegrity(Fixture):
    def commit_change(self, rel: str, text: str) -> str:
        """Commits a change in the primary checkout and returns that commit, to use as a candidate."""
        path = self.repo / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        # Stage only the intended file. The fixture repo has no .gitignore, so `add -A` would also
        # commit the test ledger under .factory-local, which real checkouts ignore.
        self._git("add", rel)
        self._git(*IDENTITY, "commit", "-q", "-m", f"change {rel}")
        return self._git("rev-parse", "HEAD").strip()

    def init_sha(self) -> str:
        return self._git("rev-parse", "HEAD~1").strip()

    def controller_with(self, adapter, project) -> Controller:
        return Controller(self.repo, self.ledger, adapter, self.config_for_tests(), project, "hash-1")

    def config_for_tests(self):
        from factory.tests.test_factory import CONFIG

        return CONFIG


class MutationDuringVerification(EvidenceIntegrity):
    def test_gate_that_changes_the_candidate_blocks_the_run(self):
        mutating = {
            **PROJECT,
            "gates": {
                **PROJECT["gates"],
                "mutating": {
                    "cwd": ".",
                    "argv": [sys.executable, "-c", "open('app/feature.txt','w').write('changed by a gate\\n')"],
                    "timeout": 30,
                },
            },
        }
        adapter = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE])
        controller = self.controller_with(adapter, mutating)
        run_id = controller.run(make_ticket(verification=["mutating"]))
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("changed during verification", run["stop_reason"])
        self.assertEqual(adapter.review_calls, 1)  # the review ran, and its approval is not accepted

    def test_reviewer_that_writes_an_untracked_file_blocks_the_run(self):
        class WritingReviewer(ScriptedAdapter):
            def review(self, workdir, ticket, diff, max_budget_usd=0.0):
                (workdir / "app" / "extra.txt").write_text("written during review\n")
                return super().review(workdir, ticket, diff, max_budget_usd)

        adapter = WritingReviewer([{"files": {"app/feature.txt": "good\n"}}], [APPROVE])
        run_id = self.controller(adapter).run(make_ticket())
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("changed during verification", run["stop_reason"])

    def test_clean_run_records_an_unchanged_snapshot(self):
        adapter = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE])
        run_id = self.controller(adapter).run(make_ticket())
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.READY)
        evidence_file = next((self.repo / ".factory-local" / "runs" / run_id).glob("evidence-*.json"))
        evidence = json.loads(evidence_file.read_text())
        self.assertFalse(evidence["worktree"]["mutated"])
        self.assertEqual(evidence["worktree"]["after"]["dirty"], [])
        self.assertEqual(evidence["worktree"]["before"]["head"], evidence["candidate_sha"])


class DirtyWorktrees(EvidenceIntegrity):
    def test_uncommitted_correction_in_the_primary_checkout_refuses_the_candidate(self):
        candidate = self.commit_change("app/feature.txt", "good\n")
        (self.repo / "app" / "feature.txt").write_text("a correction that is not committed\n")
        controller = self.controller_with(ScriptedAdapter([], [APPROVE]), PROJECT)
        with self.assertRaises(FactoryError) as ctx:
            controller.run(make_ticket(base_commit=self.init_sha()), candidate_ref=candidate)
        self.assertIn("uncommitted changes the candidate would not contain", str(ctx.exception))

    def test_untracked_relevant_file_in_the_primary_checkout_refuses_the_candidate(self):
        candidate = self.commit_change("app/feature.txt", "good\n")
        (self.repo / "app" / "extra.txt").write_text("not in the commit\n")
        controller = self.controller_with(ScriptedAdapter([], [APPROVE]), PROJECT)
        with self.assertRaises(FactoryError):
            controller.run(make_ticket(base_commit=self.init_sha()), candidate_ref=candidate)

    def test_unrelated_untracked_note_does_not_block_a_clean_candidate(self):
        candidate = self.commit_change("app/feature.txt", "good\n")
        (self.repo / "docs").mkdir(exist_ok=True)
        (self.repo / "docs" / "scratch-note.txt").write_text("a note outside the ticket's paths\n")
        controller = self.controller_with(ScriptedAdapter([], [APPROVE]), PROJECT)
        run_id = controller.run(make_ticket(base_commit=self.init_sha()), candidate_ref=candidate)
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.READY)

    def test_verify_rejects_a_worktree_with_an_uncommitted_file(self):
        adapter = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE])
        controller = self.controller(adapter)
        run_id = controller.run(make_ticket())
        self.assertTrue(controller.verify(run_id)["passed"])
        (controller.workdir(run_id) / "app" / "stray.txt").write_text("uncommitted\n")
        result = controller.verify(run_id)
        self.assertFalse(result["passed"])
        self.assertIn("uncommitted", result["reason"])


class StandaloneVerify(EvidenceIntegrity):
    """R3: `verify` is an entry point of its own. A gate that writes to the candidate must not produce a
    passing result there, even when the same gate was caught during the normal run."""

    def _ready_run_with_mutating_gate(self):
        mutating = {
            **PROJECT,
            "gates": {
                **PROJECT["gates"],
                "mutating": {
                    "cwd": ".",
                    "argv": [sys.executable, "-c", "open('app/feature.txt','w').write('changed by a gate\\n')"],
                    "timeout": 30,
                },
            },
        }
        adapter = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE])
        controller = self.controller(adapter)
        run_id = controller.run(make_ticket())
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.READY)
        # Point the stored ticket at the mutating gate; the candidate itself is unchanged.
        ticket_path = self.repo / ".factory-local" / "runs" / run_id / "ticket.json"
        stored = json.loads(ticket_path.read_text())
        stored["verification"] = ["mutating"]
        ticket_path.write_text(json.dumps(stored))
        return run_id, self.controller_with(ScriptedAdapter([], []), mutating)

    def test_standalone_verify_rejects_a_gate_that_changes_the_candidate(self):
        run_id, verifier = self._ready_run_with_mutating_gate()
        # Restore the candidate to its clean committed state, as in the review's reproduction.
        workdir = verifier.workdir(run_id)
        subprocess.run(["git", "checkout", "--", "app/feature.txt"], cwd=workdir, check=True)
        result = verifier.verify(run_id)
        self.assertFalse(result["passed"], result)
        self.assertIn("changed during verification", result["reason"])

    def test_standalone_verify_reports_the_mutated_worktree_it_left_behind(self):
        run_id, verifier = self._ready_run_with_mutating_gate()
        subprocess.run(["git", "checkout", "--", "app/feature.txt"], cwd=verifier.workdir(run_id), check=True)
        verifier.verify(run_id)
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=verifier.workdir(run_id), capture_output=True, text=True).stdout
        self.assertIn("app/feature.txt", dirty)


class WorkspaceLinks(EvidenceIntegrity):
    """The factory links installed dependencies into a worktree. That link must not count as dirt, but
    nothing else at that path may."""

    def test_declared_dependency_symlink_is_not_dirty(self):
        from factory.gitops import dirty_entries

        workdir = self.tmp / "wt"
        (self.tmp / "deps").mkdir()
        self._git("worktree", "add", "-q", "-b", "wt-links", str(workdir), "HEAD")
        (workdir / "web").mkdir(exist_ok=True)
        (workdir / "web" / "node_modules").symlink_to(self.tmp / "deps", target_is_directory=True)
        self.assertEqual(dirty_entries(workdir, ("web/node_modules",)), [])
        self.assertTrue(dirty_entries(workdir))  # without the declaration it is reported

    def test_a_real_directory_at_the_link_path_is_still_dirty(self):
        from factory.gitops import dirty_entries

        workdir = self.tmp / "wt2"
        self._git("worktree", "add", "-q", "-b", "wt-links-2", str(workdir), "HEAD")
        (workdir / "web" / "node_modules").mkdir(parents=True)
        (workdir / "web" / "node_modules" / "x.js").write_text("x\n")
        self.assertTrue(dirty_entries(workdir, ("web/node_modules",)))


class CommitIdentity(EvidenceIntegrity):
    def test_verified_commit_is_the_one_that_was_tested(self):
        candidate = self.commit_change("app/feature.txt", "good\n")
        controller = self.controller_with(ScriptedAdapter([], [APPROVE]), PROJECT)
        run_id = controller.run(make_ticket(base_commit=self.init_sha()), candidate_ref=candidate)
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["candidate_sha"], candidate)
        self.assertEqual(controller.verify(run_id)["candidate_sha"], candidate)


if __name__ == "__main__":
    import unittest

    unittest.main()
