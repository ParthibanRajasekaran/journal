"""Factory tests. Each negative case from the build spec (section 13) is exercised against a real
temporary git repository, real worktrees, real gate commands and the real SQLite ledger. Only the
model is replaced by a scripted adapter, so no provider spend occurs."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

from factory import gitops, state
from factory.adapters import AdapterResult, ClaudeCliAdapter, DryRunAdapter, parse_review
from factory.common import FactoryError
from factory.controller import Controller
from factory.controller.decision import decide
from factory.ledger import BudgetExceeded, Ledger
from factory.scope import check_scope, matches
from factory.ticket import validate_ticket

IDENTITY = ["-c", "user.name=test", "-c", "user.email=test@localhost"]
PY = sys.executable

CONFIG = {
    "budget": {"max_ticket_usd": 5.0, "per_call_reserve_usd": 0.5, "contingency_usd": 0.25, "warn_fraction": 0.7},
    "limits": {"max_repairs": 2},
    "execution": {"claude_binary": "claude", "timeout_seconds": 60, "use_bare_mode": False},
}

PROJECT = {
    "project": "fixture",
    "protected_paths": ["factory/**", "policy/**"],
    "gates": {
        "no-broken-marker": {
            "cwd": ".",
            "argv": [PY, "-c", "import pathlib,sys; sys.exit(1 if 'BROKEN' in pathlib.Path('app/feature.txt').read_text() else 0)"],
            "timeout": 30,
        },
        "always-pass": {"cwd": ".", "argv": [PY, "-c", "pass"], "timeout": 30},
    },
}


def make_ticket(**overrides) -> dict:
    ticket = {
        "id": "T-1",
        "title": "fixture ticket",
        "outcome": "app/feature.txt is never BROKEN",
        "risk_class": "medium",
        "allowed_paths": ["app/**"],
        "acceptance": [{"id": "AC-1", "text": "feature is not broken"}],
        "verification": ["no-broken-marker"],
        "budget_usd": 2.0,
        "max_repairs": 2,
    }
    ticket.update(overrides)
    return ticket


class ScriptedAdapter(DryRunAdapter):
    """Like the dry-run adapter, but the reviewer is marked independent so the ready path is reachable."""

    independent = True

    def __init__(self, implement_script=None, review_script=None):
        super().__init__(implement_script, review_script)
        self.implement_calls = 0
        self.review_calls = 0

    def implement(self, workdir, ticket, feedback, max_budget_usd=0.0):
        self.implement_calls += 1
        return super().implement(workdir, ticket, feedback, max_budget_usd)

    def review(self, workdir, ticket, diff, max_budget_usd=0.0):
        self.review_calls += 1
        return super().review(workdir, ticket, diff, max_budget_usd)


APPROVE_ALL = {"decision": "approve", "checked_acceptance": ["AC-1"], "findings": []}


class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="factory-test-"))
        self.repo = self.tmp / "repo"
        self.repo.mkdir()
        self._git("init", "-q", "-b", "main")
        for rel, text in {
            "app/feature.txt": "fine\n",
            "policy/rule.txt": "rule\n",
            "factory/config.json": "{}\n",
        }.items():
            path = self.repo / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
        self._git("add", "-A")
        self._git(*IDENTITY, "commit", "-q", "-m", "init")
        self.ledger = Ledger(self.repo / ".factory-local" / "ledger.sqlite")

    def tearDown(self):
        self.ledger.close()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _git(self, *args):
        return subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True, text=True).stdout

    def controller(self, adapter, config_hash="hash-1", config=None):
        return Controller(self.repo, self.ledger, adapter, config or CONFIG, PROJECT, config_hash)

    def dispatch_count(self, run_id, stage=None):
        sql = "select count(*) from dispatches where run_id = ?"
        args = [run_id]
        if stage:
            sql += " and stage = ?"
            args.append(stage)
        return self.ledger._conn.execute(sql, args).fetchone()[0]


class HappyPath(Fixture):
    def test_candidate_becomes_ready_with_evidence_bound_to_its_commit(self):
        adapter = ScriptedAdapter(
            [{"files": {"app/feature.txt": "good\n"}}],
            [APPROVE_ALL],
        )
        run_id = self.controller(adapter).run(make_ticket())
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.READY)
        evidence_files = list((self.repo / ".factory-local" / "runs" / run_id).glob("evidence-*.json"))
        self.assertEqual(len(evidence_files), 1)
        evidence = json.loads(evidence_files[0].read_text())
        self.assertEqual(evidence["candidate_sha"], run["candidate_sha"])
        self.assertEqual(evidence["config_hash"], "hash-1")
        self.assertTrue(all(g["passed"] for g in evidence["gates"]))

    def test_dry_run_reviewer_cannot_make_a_candidate_ready(self):
        adapter = DryRunAdapter([{"files": {"app/feature.txt": "good\n"}}])
        run_id = self.controller(adapter).run(make_ticket())
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("independent review not performed", run["stop_reason"])


class FalseCompletionAndRepair(Fixture):
    def test_claimed_success_without_changes_is_not_completion(self):
        adapter = ScriptedAdapter([{}, {}, {}], [APPROVE_ALL])
        run_id = self.controller(adapter).run(make_ticket(max_repairs=1))
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("no reviewable candidate", run["stop_reason"])
        self.assertEqual(adapter.review_calls, 0)

    def test_failing_gate_triggers_one_bounded_repair_then_ready(self):
        adapter = ScriptedAdapter(
            [{"files": {"app/feature.txt": "BROKEN\n"}}, {"files": {"app/feature.txt": "good\n"}}],
            [APPROVE_ALL, APPROVE_ALL],
        )
        run_id = self.controller(adapter).run(make_ticket())
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.READY)
        self.assertEqual(self.ledger.get_run(run_id)["repairs"], 1)
        self.assertTrue(any(e["kind"] == "repair" for e in self.ledger.events(run_id)))

    def test_repeated_repair_failure_stops_at_the_configured_limit(self):
        adapter = ScriptedAdapter(
            [{"files": {"app/feature.txt": "BROKEN 1\n"}}, {"files": {"app/feature.txt": "BROKEN 2\n"}}, {"files": {"app/feature.txt": "BROKEN 3\n"}}],
            [APPROVE_ALL, APPROVE_ALL, APPROVE_ALL],
        )
        run_id = self.controller(adapter).run(make_ticket(max_repairs=2))
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("no-broken-marker", run["stop_reason"])
        self.assertEqual(adapter.implement_calls, 3)

    def test_reviewer_that_skips_criteria_cannot_approve(self):
        adapter = ScriptedAdapter(
            [{"files": {"app/feature.txt": "a\n"}}, {"files": {"app/feature.txt": "b\n"}}, {"files": {"app/feature.txt": "c\n"}}],
            [{"decision": "approve", "checked_acceptance": [], "findings": []}] * 3,
        )
        run_id = self.controller(adapter).run(make_ticket(max_repairs=2))
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("did not check acceptance: AC-1", run["stop_reason"])


class ScopeAndProtection(Fixture):
    def test_edit_outside_allowed_paths_blocks_before_review(self):
        adapter = ScriptedAdapter([{"files": {"docs/notes.txt": "a new note\n"}}], [APPROVE_ALL])
        run_id = self.controller(adapter).run(make_ticket())
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("outside the ticket's allowed paths: docs/notes.txt", run["stop_reason"])
        self.assertEqual(adapter.review_calls, 0)

    def test_agent_cannot_edit_protected_config_even_when_allowed(self):
        adapter = ScriptedAdapter([{"files": {"factory/config.json": '{"budget": {"max_ticket_usd": 999}}\n'}}], [APPROVE_ALL])
        run_id = self.controller(adapter).run(make_ticket(allowed_paths=["**"]))
        run = self.ledger.get_run(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("protected path changed: factory/config.json", run["stop_reason"])
        self.assertEqual(adapter.review_calls, 0)

    def test_ticket_cannot_inject_a_gate_command(self):
        errors = validate_ticket(make_ticket(verification=["rm -rf /"]), PROJECT, 5.0, 2)
        self.assertTrue(any("not defined in the protected project file" in e for e in errors))

    def test_candidate_cannot_change_the_budget_cap_to_pass(self):
        # A protected-config edit blocks approval even if every gate and the reviewer would pass.
        adapter = ScriptedAdapter(
            [{"files": {"factory/config.json": '{"budget": {"max_ticket_usd": 999}}\n', "app/feature.txt": "good\n"}}],
            [APPROVE_ALL],
        )
        run_id = self.controller(adapter).run(make_ticket(allowed_paths=["app/**", "factory/**"]))
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.BLOCKED)


class StaleEvidence(Fixture):
    def test_new_commit_invalidates_earlier_evidence(self):
        adapter = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE_ALL])
        controller = self.controller(adapter)
        run_id = controller.run(make_ticket())
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.READY)
        self.assertTrue(controller.verify(run_id)["passed"])

        workdir = controller.workdir(run_id)
        (workdir / "app" / "feature.txt").write_text("later edit\n")
        subprocess.run(["git", *IDENTITY, "commit", "-qam", "later"], cwd=workdir, check=True)

        result = controller.verify(run_id)
        self.assertFalse(result["passed"])
        self.assertIn("stale", result["reason"])

    def test_gate_configuration_change_makes_verification_stale(self):
        adapter = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE_ALL])
        run_id = self.controller(adapter).run(make_ticket())
        result = self.controller(adapter, config_hash="hash-2").verify(run_id)
        self.assertFalse(result["passed"])
        self.assertIn("gate configuration changed", result["reason"])


class BudgetAndLineage(Fixture):
    def test_concurrent_children_cannot_both_take_the_last_affordable_reservation(self):
        lineage = self.ledger.lineage_for("T-RACE", cap_usd=1.0)
        run_id = "run-race"
        self.ledger.create_run(run_id, lineage, "T-RACE", "b", "h", "dry-run")
        outcomes = []
        barrier = threading.Barrier(4)

        def attempt():
            ledger = Ledger(self.repo / ".factory-local" / "ledger.sqlite")
            barrier.wait()
            try:
                ledger.reserve(lineage, run_id, "implementer", "implement", 0.5, 0.25)
                outcomes.append("admitted")
            except BudgetExceeded:
                outcomes.append("refused")
            finally:
                ledger.close()

        threads = [threading.Thread(target=attempt) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(outcomes.count("admitted"), 1, outcomes)
        self.assertEqual(outcomes.count("refused"), 3, outcomes)

    def test_a_resumed_or_new_run_shares_the_ticket_lineage(self):
        first = self.ledger.lineage_for("T-9", 2.0)
        self.ledger.create_run("run-a", first, "T-9", "b", "h", "dry-run")
        r1 = self.ledger.reserve(first, "run-a", "implementer", "implement", 1.5, 0.0)
        self.ledger.settle(r1, 1.5, "provider-reported")
        second = self.ledger.lineage_for("T-9", 2.0)
        self.assertEqual(first, second)
        self.ledger.create_run("run-b", second, "T-9", "b", "h", "dry-run")
        with self.assertRaises(BudgetExceeded):
            self.ledger.reserve(second, "run-b", "implementer", "implement", 0.6, 0.0)

    def test_unknown_spend_keeps_the_worst_case_and_is_labelled(self):
        lineage = self.ledger.lineage_for("T-U", 2.0)
        self.ledger.create_run("run-u", lineage, "T-U", "b", "h", "live")
        rid = self.ledger.reserve(lineage, "run-u", "reviewer", "review", 0.5, 0.0)
        self.ledger.settle(rid, None, "")
        usage = self.ledger.usage(lineage)
        self.assertAlmostEqual(usage["committed_usd"], 0.5)
        self.assertEqual(usage["unknown_spend_entries"], 1)

    def test_released_reservation_frees_capacity(self):
        lineage = self.ledger.lineage_for("T-R", 0.5)
        self.ledger.create_run("run-r", lineage, "T-R", "b", "h", "dry-run")
        rid = self.ledger.reserve(lineage, "run-r", "implementer", "implement", 0.5, 0.0)
        with self.assertRaises(BudgetExceeded):
            self.ledger.reserve(lineage, "run-r", "reviewer", "review", 0.5, 0.0)
        self.ledger.release(rid)
        self.ledger.reserve(lineage, "run-r", "reviewer", "review", 0.5, 0.0)


class CrashAndResume(Fixture):
    def test_crash_after_dispatch_is_not_repeated_on_resume(self):
        class Crash(BaseException):
            pass

        class CrashingAdapter(ScriptedAdapter):
            def implement(self, *args, **kwargs):
                raise Crash()

        controller = self.controller(CrashingAdapter([], []))
        with self.assertRaises(Crash):
            controller.run(make_ticket())
        run_id = self.ledger._conn.execute("select id from runs order by updated_at desc limit 1").fetchone()[0]

        fresh = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE_ALL])
        final = self.controller(fresh).resume(run_id)
        self.assertEqual(final, state.BLOCKED)
        self.assertIn("not re-dispatched", self.ledger.get_run(run_id)["stop_reason"])
        self.assertEqual(fresh.implement_calls, 0)
        self.assertGreaterEqual(self.ledger.usage(self.ledger.get_run(run_id)["lineage_id"])["open_or_orphaned"], 1)

    def test_pause_then_resume_completes_without_repeating_work(self):
        class PausingAdapter(ScriptedAdapter):
            def implement(self, workdir, ticket, feedback, max_budget_usd=0.0):
                result = super().implement(workdir, ticket, feedback, max_budget_usd)
                run_id = self.ledger_ref._conn.execute("select id from runs order by updated_at desc limit 1").fetchone()[0]
                self.ledger_ref.update_run(run_id, pause_requested=1)
                return result

        adapter = PausingAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE_ALL])
        adapter.ledger_ref = self.ledger
        controller = self.controller(adapter)
        controller.run(make_ticket())
        run_id = self.ledger._conn.execute("select id from runs order by updated_at desc limit 1").fetchone()[0]
        self.assertEqual(self.ledger.get_run(run_id)["state"], state.PAUSED)

        final = controller.resume(run_id)
        self.assertEqual(final, state.READY)
        self.assertEqual(adapter.implement_calls, 1)

    def test_config_change_refuses_to_resume(self):
        adapter = ScriptedAdapter([{"files": {"app/feature.txt": "good\n"}}], [APPROVE_ALL])
        controller = self.controller(adapter)
        run_id = controller.run(make_ticket())
        self.ledger.update_run(run_id, state=state.PAUSED, resume_state=state.VERIFYING)
        with self.assertRaises(FactoryError):
            self.controller(adapter, config_hash="changed").resume(run_id)


class StateAndSchemas(unittest.TestCase):
    def test_illegal_transitions_are_refused(self):
        with self.assertRaises(state.IllegalTransition):
            state.check_transition(state.READY, state.VERIFYING)
        with self.assertRaises(state.IllegalTransition):
            state.check_transition(state.BLOCKED, state.READY)

    def test_ticket_validation_reports_each_problem(self):
        errors = validate_ticket(make_ticket(budget_usd=99, max_repairs=9, acceptance=[]), PROJECT, 5.0, 2)
        self.assertTrue(any("budget_usd" in e for e in errors))
        self.assertTrue(any("max_repairs" in e for e in errors))
        self.assertTrue(any("acceptance" in e for e in errors))

    def test_plan_reports_worst_case_budget_without_dispatch(self):
        adapter = DryRunAdapter()
        with tempfile.TemporaryDirectory() as tmp:
            controller = Controller(Path(tmp), self.ledger_for(tmp), adapter, CONFIG, PROJECT, "h")
            plan = controller.plan(make_ticket(max_repairs=2))
        self.assertEqual(plan["worst_case_calls"], 6)
        self.assertFalse(plan["independent_review"])

    def ledger_for(self, tmp):
        return Ledger(Path(tmp) / "ledger.sqlite")


class ScopeRules(unittest.TestCase):
    def test_double_star_matches_any_depth_and_single_star_does_not(self):
        self.assertTrue(matches("web/src/a/b/c.ts", ["web/**"]))
        self.assertTrue(matches("factory/config.json", ["factory/**"]))
        self.assertFalse(matches("webx/a.ts", ["web/**"]))
        self.assertTrue(matches("app/a.txt", ["app/*.txt"]))
        self.assertFalse(matches("app/a/b.txt", ["app/*.txt"]))

    def test_protected_paths_win_over_allowed_paths(self):
        problems = check_scope(["factory/config.json", "app/x.txt"], ["**"], ["factory/**"])
        self.assertEqual(problems, ["protected path changed: factory/config.json"])


class ReviewParsing(unittest.TestCase):
    def test_review_object_is_extracted_from_surrounding_text(self):
        parsed = parse_review('Here you go: {"decision": "approve", "checked_acceptance": ["AC-1"], "findings": []} done')
        self.assertEqual(parsed["decision"], "approve")

    def test_malformed_or_unknown_review_is_rejected(self):
        self.assertIsNone(parse_review("no json here"))
        self.assertIsNone(parse_review('{"decision": "maybe", "checked_acceptance": []}'))
        self.assertIsNone(parse_review('{"decision": "approve"}'))

    def test_decide_requires_independence_and_every_criterion(self):
        ticket = make_ticket()
        evidence = {
            "scope": {"violations": []},
            "gates": [{"id": "g", "passed": True}],
            "review": {"ok": True, "independent": False, "decision": "approve", "checked_acceptance": ["AC-1"]},
        }
        self.assertEqual(decide(evidence, ticket)[0], "block")
        evidence["review"]["independent"] = True
        self.assertEqual(decide(evidence, ticket)[0], "ready")
        evidence["review"]["checked_acceptance"] = []
        self.assertEqual(decide(evidence, ticket)[0], "repair")


class ClaudeAdapter(unittest.TestCase):
    def fake_runner(self, payload: dict, capture: list):
        def run(argv, **kwargs):
            capture.append(argv)
            return subprocess.CompletedProcess(argv, 0, stdout=json.dumps(payload), stderr="")

        return run

    def test_reviewer_runs_read_only_with_budget_and_reports_cost(self):
        calls: list = []
        payload = {
            "subtype": "success",
            "is_error": False,
            "result": json.dumps({"decision": "approve", "checked_acceptance": ["AC-1"], "findings": []}),
            "total_cost_usd": 0.12,
            "session_id": "s1",
        }
        adapter = ClaudeCliAdapter("claude", {"-p", "--output-format", "--max-budget-usd", "--tools", "--no-session-persistence"}, 60, False, runner=self.fake_runner(payload, calls))
        result = adapter.review(Path("."), make_ticket(), "diff", max_budget_usd=0.5)
        argv = calls[0]
        self.assertIn("--max-budget-usd", argv)
        self.assertEqual(argv[argv.index("--max-budget-usd") + 1], "0.50")
        self.assertEqual(argv[argv.index("--tools") + 1], "Read,Glob,Grep")
        self.assertNotIn("--permission-mode", argv)
        self.assertTrue(result.ok)
        self.assertAlmostEqual(result.cost_usd, 0.12)
        self.assertEqual(result.payload["decision"], "approve")

    def test_unsupported_flags_are_omitted_not_assumed(self):
        calls: list = []
        payload = {"subtype": "success", "is_error": False, "result": "{}", "total_cost_usd": 0.0}
        adapter = ClaudeCliAdapter("claude", {"-p", "--output-format"}, 60, True, runner=self.fake_runner(payload, calls))
        adapter.implement(Path("."), make_ticket(), None, max_budget_usd=0.5)
        self.assertNotIn("--max-budget-usd", calls[0])
        self.assertNotIn("--bare", calls[0])

    def test_budget_exhaustion_is_reported_as_failure_with_its_cost(self):
        calls: list = []
        payload = {"subtype": "error_max_budget_usd", "is_error": True, "errors": ["Reached maximum budget"], "total_cost_usd": 0.32}
        adapter = ClaudeCliAdapter("claude", {"-p", "--output-format", "--max-budget-usd"}, 60, False, runner=self.fake_runner(payload, calls))
        result = adapter.implement(Path("."), make_ticket(), None, max_budget_usd=0.05)
        self.assertFalse(result.ok)
        self.assertAlmostEqual(result.cost_usd, 0.32)
        self.assertIn("maximum budget", result.detail)

    def test_non_json_output_is_a_failure_not_a_pass(self):
        def run(argv, **kwargs):
            return subprocess.CompletedProcess(argv, 1, stdout="Traceback...", stderr="")

        adapter = ClaudeCliAdapter("claude", {"-p", "--output-format"}, 60, False, runner=run)
        result = adapter.review(Path("."), make_ticket(), "diff")
        self.assertFalse(result.ok)


class GitIsolation(Fixture):
    def test_worktree_is_created_from_base_and_removed_cleanly(self):
        base = gitops.resolve(self.repo, "HEAD")
        path = self.tmp / "wt"
        gitops.add_worktree(self.repo, path, "factory/test/wt", base)
        self.assertEqual(gitops.head(path), base)
        gitops.remove_worktree(self.repo, path)
        self.assertFalse(path.exists())


if __name__ == "__main__":
    unittest.main()
