"""Provider policy, quota handling, durable handoffs and resume, verified end to end.

A fake `claude` executable (a Python script driven by state files) stands in for the real CLI. The real
adapter, policy, quota classifier, controller and ledger all run unmodified. Nothing here calls a model
or spends money. Each test name states the behaviour it proves."""

from __future__ import annotations

import json
import os
import textwrap
from pathlib import Path
from unittest import mock

from factory import state
from factory.adapters import ClaudeCliAdapter
from factory.controller import Controller
from factory.controller.core import QuotaExhausted
from factory.locks import WorkspaceHeld, WorkspaceLock
from factory.providers import CLAUDE, ProviderPolicy, classify_claude_result, quota_status
from factory.tests.test_factory import CONFIG, PROJECT, Fixture, make_ticket

FAKE_CLAUDE = textwrap.dedent(
    '''\
    #!/usr/bin/env python3
    """Fake Claude Code CLI for factory tests. Behaviour comes from files next to this script."""
    import json, os, sys
    here = os.path.dirname(os.path.abspath(__file__))
    argv = sys.argv[1:]
    with open(os.path.join(here, "calls.log"), "a") as log:
        log.write((argv[0] if argv else "") + "\\n")
    mode = open(os.path.join(here, "mode")).read().strip()
    if argv[:1] == ["--version"]:
        print("2.1.309 (fake)")
    elif argv[:1] == ["--help"]:
        print(open(os.path.join(here, "help.txt")).read())
    elif argv[:1] == ["auth"]:
        print(open(os.path.join(here, "auth.json")).read())
    elif argv[:1] == ["-p"]:
        prompt = argv[1]
        if mode == "quota":
            print(json.dumps({"type": "result", "subtype": "error_during_execution", "is_error": True,
                              "errors": ["Usage limit reached for your plan."], "total_cost_usd": 0}))
            sys.exit(1)
        if "implementer for ticket" in prompt:
            open("app/feature.txt", "w").write("good\\n")
            result = "implemented"
        else:
            result = json.dumps({"decision": "approve", "checked_acceptance": ["AC-1"], "findings": []})
        print(json.dumps({"type": "result", "subtype": "success", "is_error": False,
                          "result": result, "total_cost_usd": 0.01, "session_id": "fake"}))
    else:
        sys.exit(2)
    '''
)

HELP = "Usage: claude\n  -p, --print\n  --output-format <format>\n  --max-budget-usd <amount>\n  --tools <tools...>\n  --permission-mode <mode>\n  --no-session-persistence\n"

SUBSCRIPTION = {"loggedIn": True, "authMethod": "claude.ai", "apiProvider": "firstParty", "subscriptionType": "pro"}

ENABLED_CONFIG = {**CONFIG, "providers": {"default_enabled": {"claude-code": True, "codex": False, "gemini": False}}}


class ProviderFixture(Fixture):
    def setUp(self):
        super().setUp()
        self.fake_dir = self.tmp / "fake-claude"
        self.fake_dir.mkdir()
        binary = self.fake_dir / "claude"
        binary.write_text(FAKE_CLAUDE)
        binary.chmod(0o755)
        (self.fake_dir / "help.txt").write_text(HELP)
        self.set_mode("ok")
        self.set_auth(SUBSCRIPTION)
        self.binary = str(binary)
        self.state_dir = self.repo / ".factory-local"

    def set_mode(self, mode: str):
        (self.fake_dir / "mode").write_text(mode)

    def set_auth(self, auth: dict):
        (self.fake_dir / "auth.json").write_text(json.dumps(auth))

    def claude_calls(self) -> list[str]:
        log = self.fake_dir / "calls.log"
        return log.read_text().splitlines() if log.exists() else []

    def policy(self, env=None) -> ProviderPolicy:
        return ProviderPolicy(self.state_dir, ENABLED_CONFIG, self.binary, env={} if env is None else env)

    def attest(self):
        self.policy().attest(CLAUDE, "extra-usage-disabled")

    def controller(self, env=None, config_hash="hash-1") -> Controller:
        adapter = ClaudeCliAdapter(self.binary, {"-p", "--output-format", "--max-budget-usd", "--tools", "--no-session-persistence", "--permission-mode"}, 60, False, policy=self.policy(env))
        return Controller(self.repo, self.ledger, adapter, ENABLED_CONFIG, PROJECT, config_hash)

    def run_row(self, run_id):
        return self.ledger.get_run(run_id)

    def latest_run(self):
        return self.ledger._conn.execute("select id from runs order by updated_at desc limit 1").fetchone()[0]


class PaidRouteRefusal(ProviderFixture):
    def test_api_key_sign_in_is_refused_before_any_reservation_or_call(self):
        self.attest()
        self.set_auth({**SUBSCRIPTION, "authMethod": "api_key"})
        controller = self.controller()
        controller.run(make_ticket())  # a refused run is recorded as blocked; run() does not raise
        run_id = self.latest_run()
        run = self.run_row(run_id)
        self.assertEqual(run["state"], state.BLOCKED)
        self.assertIn("no-spend policy refused implement", run["stop_reason"])
        self.assertEqual(self.ledger.reservations(run_id), [])
        self.assertNotIn("-p", self.claude_calls())

    def test_api_billing_variable_refuses_and_never_echoes_its_value(self):
        self.attest()
        verdict = self.policy(env={"ANTHROPIC_API_KEY": "sk-test-secret-value"}).evaluate(CLAUDE)
        self.assertFalse(verdict.eligible)
        self.assertIn("ANTHROPIC_API_KEY", verdict.reason)
        self.assertNotIn("sk-test-secret-value", verdict.reason)

    def test_unknown_billing_without_owner_attestation_blocks_dispatch(self):
        verdict = self.policy().evaluate(CLAUDE)
        self.assertFalse(verdict.eligible)
        self.assertIn("has not confirmed that extra usage is off", verdict.reason)
        run_id = self.controller().run(make_ticket())
        self.assertEqual(self.run_row(run_id)["state"], state.BLOCKED)
        self.assertNotIn("-p", self.claude_calls())

    def test_unverifiable_sign_in_blocks(self):
        self.attest()
        (self.fake_dir / "auth.json").write_text("not json")
        verdict = self.policy().evaluate(CLAUDE)
        self.assertFalse(verdict.eligible)
        self.assertIn("could not verify sign-in", verdict.reason)

    def test_team_or_third_party_provider_is_not_a_first_party_subscription(self):
        self.attest()
        self.set_auth({**SUBSCRIPTION, "apiProvider": "bedrock"})
        verdict = self.policy().evaluate(CLAUDE)
        self.assertFalse(verdict.eligible)
        self.assertIn("not a first-party subscription", verdict.reason)

    def test_disabled_toggle_blocks_even_with_good_sign_in(self):
        self.attest()
        self.policy().set_toggle(CLAUDE, False)
        verdict = self.policy().evaluate(CLAUDE)
        self.assertFalse(verdict.eligible)
        self.assertIn("disabled by owner toggle", verdict.reason)

    def test_codex_and_gemini_are_never_eligible_without_a_verified_adapter(self):
        self.policy().set_toggle("codex", True)
        self.policy().set_toggle("gemini", True)
        for name in ("codex", "gemini"):
            verdict = self.policy().evaluate(name)
            self.assertFalse(verdict.eligible)
            self.assertIn("no verified", verdict.reason)

    def test_subscription_with_owner_attestation_is_eligible_and_quota_is_unknown(self):
        self.attest()
        verdict = self.policy().evaluate(CLAUDE)
        self.assertTrue(verdict.eligible)
        self.assertEqual(verdict.quota, "unknown")
        self.assertEqual(quota_status(CLAUDE)["state"], "unknown")
        self.assertNotIn("email", json.dumps(verdict.facts))


class QuotaHandling(ProviderFixture):
    def test_quota_exhaustion_pauses_with_durable_handoff_not_failure(self):
        self.attest()
        self.set_mode("quota")
        run_id = self.controller().run(make_ticket())
        run = self.run_row(run_id)
        self.assertEqual(run["state"], state.PAUSED)
        self.assertIn("quota exhausted", run["stop_reason"])
        self.assertIn("remaining quota unknown", run["stop_reason"])
        handoffs = self.ledger.open_handoffs(run_id)
        self.assertEqual(len(handoffs), 1)
        self.assertEqual(handoffs[0]["stage"], "implement")
        record = json.loads(next((self.repo / ".factory-local" / "runs" / run_id).glob("handoff-*.json")).read_text())
        self.assertEqual(record["quota"]["state"], "unknown")
        self.assertEqual(record["provider"], CLAUDE)

    def test_resume_while_quota_still_exhausted_pauses_again_without_spinning(self):
        self.attest()
        self.set_mode("quota")
        controller = self.controller()
        run_id = controller.run(make_ticket())
        self.assertEqual(controller.resume(run_id), state.PAUSED)
        self.assertEqual(self.run_row(run_id)["state"], state.PAUSED)
        self.assertEqual(len(self.ledger.open_handoffs(run_id)), 2)
        self.assertEqual(self.claude_calls().count("-p"), 2)

    def test_resumed_work_completes_after_quota_returns_and_closes_handoff(self):
        self.attest()
        self.set_mode("quota")
        controller = self.controller()
        run_id = controller.run(make_ticket())
        self.assertEqual(self.run_row(run_id)["state"], state.PAUSED)

        self.set_mode("ok")
        self.assertEqual(controller.resume(run_id), state.READY)
        self.assertEqual(self.ledger.open_handoffs(run_id), [])
        self.assertTrue(any(e["kind"] == "handoff-closed" for e in self.ledger.events(run_id)))
        evidence = list((self.repo / ".factory-local" / "runs" / run_id).glob("evidence-*.json"))
        self.assertEqual(len(evidence), 1)

    def test_interrupted_handoff_is_retried_without_duplicating_work(self):
        self.attest()
        self.set_mode("quota")
        controller = self.controller()
        crash = type("Crash", (BaseException,), {})
        real_transition = controller._transition

        def crash_on_pause(run_id, nxt):
            if nxt == state.PAUSED:
                raise crash()
            real_transition(run_id, nxt)

        with mock.patch.object(controller, "_transition", side_effect=crash_on_pause):
            with self.assertRaises(crash):
                controller.run(make_ticket())
        run_id = self.latest_run()
        # The crash happened after the handoff was written but before the pause was saved.
        self.assertEqual(self.run_row(run_id)["state"], state.IMPLEMENTING)
        self.assertEqual(len(self.ledger.open_handoffs(run_id)), 1)
        self.assertEqual(self.ledger._conn.execute("select status from dispatches where run_id=?", (run_id,)).fetchone()[0], "failed")

        self.set_mode("ok")
        self.assertEqual(self.controller().resume(run_id), state.READY)
        self.assertEqual(self.ledger.open_handoffs(run_id), [])
        statuses = [r[0] for r in self.ledger._conn.execute("select status from dispatches where run_id=? order by id", (run_id,))]
        self.assertNotIn("started", statuses)
        self.assertEqual(statuses.count("finished"), 2)  # one implementation and one review, each once

    def test_resume_is_deferred_while_provider_is_ineligible(self):
        self.attest()
        self.set_mode("quota")
        controller = self.controller()
        run_id = controller.run(make_ticket())
        self.policy().set_toggle(CLAUDE, False)
        self.assertEqual(controller.resume(run_id), state.PAUSED)
        self.assertTrue(any(e["kind"] == "resume-deferred" for e in self.ledger.events(run_id)))
        self.assertEqual(self.claude_calls().count("-p"), 1)  # no dispatch was attempted while ineligible


class WorkspaceOwnership(ProviderFixture):
    def test_second_controller_cannot_write_a_run_held_by_another(self):
        self.attest()
        self.set_mode("quota")
        controller = self.controller()
        run_id = controller.run(make_ticket())
        self.set_mode("ok")
        with WorkspaceLock(self.state_dir / "locks", run_id):
            with self.assertRaises(WorkspaceHeld) as ctx:
                self.controller().resume(run_id)
            self.assertIn("only one controller", str(ctx.exception))
        self.assertEqual(self.controller().resume(run_id), state.READY)

    def test_lock_is_released_when_the_holder_finishes(self):
        with WorkspaceLock(self.state_dir / "locks", "run-x"):
            pass
        with WorkspaceLock(self.state_dir / "locks", "run-x"):
            pass


class ClassificationAndState(ProviderFixture):
    def test_quota_text_is_quota_but_a_budget_stop_is_a_plain_failure(self):
        self.assertEqual(classify_claude_result({"subtype": "error_during_execution", "is_error": True, "errors": ["Rate limit exceeded"]}), "quota")
        self.assertEqual(classify_claude_result({"subtype": "error_max_budget_usd", "is_error": True, "errors": ["Reached maximum budget"]}), "failed")
        self.assertEqual(classify_claude_result({"subtype": "success", "is_error": False, "result": "fine"}), "ok")
        self.assertEqual(classify_claude_result(None), "failed")

    def test_provider_eligibility_is_checked_before_reservation_in_the_adapter_path(self):
        # The adapter's own check also refuses when invoked directly, not only through the controller.
        adapter = ClaudeCliAdapter(self.binary, {"-p", "--output-format"}, 60, False, policy=self.policy())
        result = adapter.review(self.repo, make_ticket(), "diff")
        self.assertFalse(result.ok)
        self.assertTrue(result.extra.get("refused"))
        self.assertNotIn("-p", self.claude_calls())


if __name__ == "__main__":
    import unittest

    unittest.main()
