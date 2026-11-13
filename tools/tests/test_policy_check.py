"""Tests for the bootstrap policy checker. Run: python3 -m unittest discover -s tools/tests -t . -p "test_*.py"

Covers the decision rules, and the trust regression: a pull request that replaces the checker with one that
approves everything is rejected when the trusted checker runs, and passes only when it judges itself."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools.policy_check import Policy, approved_prefixes, change_violations, parse_policy, static_prefix

ROOT = Path(__file__).resolve().parents[2]
POLICY = """package journal.agents.change
allowed_globs := [
	"app/**",
	"docs/**",
]
protected_globs := [
	"policy/**",
	"tools/**",
]
"""
PERMISSIVE = "\ndef change_violations(changed, policy, approved):\n    return []\n"


def git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


class DecisionRules(unittest.TestCase):
    policy = parse_policy(POLICY)

    def test_policy_lists_are_read(self):
        self.assertEqual(self.policy.allowed, ("app/**", "docs/**"))
        self.assertIn("tools/**", self.policy.protected)

    def test_allowed_roots_pass(self):
        self.assertEqual(change_violations(["app/x.ts", "docs/n.md"], self.policy, ()), [])

    def test_protected_paths_fail_even_when_approved(self):
        out = change_violations(["tools/policy_check.py"], self.policy, ("tools/",))
        self.assertEqual(out, ["policy: protected path changed: tools/policy_check.py"])

    def test_an_approval_file_cannot_approve_itself(self):
        out = change_violations(["docs/factory/policy-exceptions.json"], self.policy, ())
        self.assertTrue(out and "protected path changed" in out[0])

    def test_outside_roots_without_approval_fails(self):
        self.assertEqual(len(change_violations(["web/src/a.ts"], self.policy, ())), 1)

    def test_approved_prefix_passes_only_when_approved(self):
        self.assertEqual(change_violations(["web/src/a.ts"], self.policy, ("web/src/",)), [])
        self.assertEqual(static_prefix("web/src/**"), "web/src/")


class Approvals(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        git(self.tmp, "init", "-q", "-b", "main")
        git(self.tmp, "config", "user.name", "t")
        git(self.tmp, "config", "user.email", "t@localhost")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def commit_approvals(self, entries):
        (self.tmp / "docs" / "factory").mkdir(parents=True, exist_ok=True)
        (self.tmp / "docs" / "factory" / "policy-exceptions.json").write_text(json.dumps({"exceptions": entries}))
        git(self.tmp, "add", "-A")
        git(self.tmp, "commit", "-q", "-m", "approvals")
        return git(self.tmp, "rev-parse", "HEAD")

    def test_pending_authorizes_nothing(self):
        sha = self.commit_approvals([{"prefix": "web/", "status": "pending-owner-approval"}])
        self.assertEqual(approved_prefixes(str(self.tmp), sha), ())

    def test_approved_without_an_approver_authorizes_nothing(self):
        sha = self.commit_approvals([{"prefix": "web/", "status": "approved", "approved_by": ""}])
        self.assertEqual(approved_prefixes(str(self.tmp), sha), ())

    def test_approved_with_an_approver_authorizes(self):
        sha = self.commit_approvals([{"prefix": "web/src/", "status": "approved", "approved_by": "owner"}])
        self.assertEqual(approved_prefixes(str(self.tmp), sha), ("web/src/",))


class TrustRegression(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="trust-"))
        self.base, self.cand = self.tmp / "base", self.tmp / "pr"
        self.base.mkdir()
        git(self.base, "init", "-q", "-b", "main")
        git(self.base, "config", "user.name", "t")
        git(self.base, "config", "user.email", "t@localhost")
        (self.base / "policy" / "agents").mkdir(parents=True)
        (self.base / "policy" / "agents" / "change_policy.rego").write_text(POLICY)
        (self.base / "tools").mkdir()
        shutil.copy(ROOT / "tools" / "policy_check.py", self.base / "tools" / "policy_check.py")
        git(self.base, "add", "-A")
        git(self.base, "commit", "-q", "-m", "base")
        self.base_sha = git(self.base, "rev-parse", "HEAD")
        git(self.base, "worktree", "add", "-q", "-b", "pr", str(self.cand), self.base_sha)
        (self.cand / "web" / "src").mkdir(parents=True)
        (self.cand / "web" / "src" / "x.ts").write_text("export {};\n")
        # The override goes above the entry point, where it takes effect before main() runs.
        source = (self.cand / "tools" / "policy_check.py").read_text()
        head, guard, tail = source.partition('\nif __name__ == "__main__":')
        (self.cand / "tools" / "policy_check.py").write_text(head + PERMISSIVE + guard + tail)
        git(self.cand, "add", "-A")
        git(self.cand, "commit", "-q", "-m", "pr")
        self.head_sha = git(self.cand, "rev-parse", "HEAD")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_checker(self, script_dir):
        env = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "/tmp")}
        return subprocess.run(
            [sys.executable, str(script_dir / "tools" / "policy_check.py"), "--repo", str(self.cand),
             "--base", self.base_sha, "--head", self.head_sha],
            capture_output=True, text=True, env=env, timeout=120,
        )

    def test_the_trusted_checker_rejects_the_pull_request(self):
        proc = self.run_checker(self.base)
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertIn("web/src/x.ts", proc.stdout)
        self.assertIn("tools/policy_check.py", proc.stdout)

    def test_the_pull_requests_own_checker_passes_it_the_bypass(self):
        proc = self.run_checker(self.cand)
        self.assertEqual(proc.returncode, 0, "the bypass succeeds when the candidate judges itself")

    def test_a_missing_policy_at_base_is_an_operator_error(self):
        git(self.base, "rm", "-q", "policy/agents/change_policy.rego")
        git(self.base, "commit", "-q", "-m", "remove policy")
        sha = git(self.base, "rev-parse", "HEAD")
        env = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "/tmp")}
        proc = subprocess.run(
            [sys.executable, str(self.base / "tools" / "policy_check.py"), "--repo", str(self.cand),
             "--base", sha, "--head", self.head_sha],
            capture_output=True, text=True, env=env, timeout=120,
        )
        self.assertEqual(proc.returncode, 1)


if __name__ == "__main__":
    unittest.main()
