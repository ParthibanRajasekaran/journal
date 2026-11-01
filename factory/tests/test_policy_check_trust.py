"""The CI policy check must not be judged by the code it checks (review finding: self-judging checker).

A pull request could replace factory/policy_gate.py with a checker that always passes. If CI ran the
checker from the pull request's own checkout, that change would approve itself. These tests reproduce
that bypass, then show the trusted-checkout arrangement rejects the same candidate.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
POLICY = """package journal.agents.change
allowed_globs := [
	"app/**",
	"docs/**",
]
protected_globs := [
	"policy/**",
	"factory/**",
]
"""
PERMISSIVE_CHECKER = """
def change_violations(changed, policy, approved):
    return []
"""


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def copy_factory(into: Path) -> None:
    shutil.copytree(
        REPO / "factory",
        into / "factory",
        ignore=shutil.ignore_patterns("__pycache__", "tests", ".factory-local"),
    )


class CheckerTrust(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="factory-trust-"))
        self.base = self.tmp / "base"
        self.candidate = self.tmp / "candidate"
        self.trusted = self.tmp / "trusted"
        self.base.mkdir()
        git(self.base, "init", "-q", "-b", "main")
        git(self.base, "config", "user.name", "t")
        git(self.base, "config", "user.email", "t@localhost")
        (self.base / "policy" / "agents").mkdir(parents=True)
        (self.base / "policy" / "agents" / "change_policy.rego").write_text(POLICY)
        (self.base / "app").mkdir()
        (self.base / "app" / "feature.txt").write_text("fine\n")
        copy_factory(self.base)
        git(self.base, "add", "-A")
        git(self.base, "commit", "-q", "-m", "base")
        self.base_sha = git(self.base, "rev-parse", "HEAD")

        # The pull request: a disallowed web file, plus a checker that approves everything.
        git(self.base, "worktree", "add", "-q", "-b", "pr", str(self.candidate), self.base_sha)
        (self.candidate / "web" / "src").mkdir(parents=True)
        (self.candidate / "web" / "src" / "x.ts").write_text("export {};\n")
        (self.candidate / "factory" / "policy_gate.py").write_text(
            (self.candidate / "factory" / "policy_gate.py").read_text() + PERMISSIVE_CHECKER
        )
        git(self.candidate, "add", "-A")
        git(self.candidate, "commit", "-q", "-m", "pr")
        self.head_sha = git(self.candidate, "rev-parse", "HEAD")

        # The trusted checker: a copy of the base commit's factory, outside the pull request.
        self.trusted.mkdir()
        copy_factory(self.trusted)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_check(self, cwd: Path) -> subprocess.CompletedProcess:
        env = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "/tmp")}
        return subprocess.run(
            [sys.executable, "-m", "factory", "policy-check", "--repo", str(self.candidate),
             "--base", self.base_sha, "--head", self.head_sha],
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )

    def test_the_trusted_checker_rejects_the_pull_request(self):
        proc = self.run_check(self.trusted)
        self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
        self.assertIn("web/src/x.ts", proc.stdout)
        self.assertIn("factory/policy_gate.py", proc.stdout)

    def test_a_checker_taken_from_the_pull_request_passes_it_the_bypass(self):
        # Reproduction of the hazard: the candidate's own checker approves the candidate.
        proc = self.run_check(self.candidate)
        self.assertEqual(proc.returncode, 0, "the bypass should succeed when the candidate judges itself")


if __name__ == "__main__":
    unittest.main()
