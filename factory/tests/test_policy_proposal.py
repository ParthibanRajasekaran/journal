"""Option A proposal: OPA tests run, and the Python change-set enforcement agrees with the Rego decision
on the same paths. A disagreement fails the test, so the two implementations cannot drift apart silently.

Skipped with a visible reason if the opa binary is not installed. It is installed in this environment."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from factory.policy_gate import change_violations, parse_policy

REPO = Path(__file__).resolve().parents[2]
PROPOSAL = REPO / "docs" / "factory" / "proposals" / "change_policy.option-a.rego"
PROPOSAL_DIR = REPO / "docs" / "factory" / "proposals"
PATHS = [
    "src/a.ts",
    "backend/app/x.py",
    "docs/notes.md",
    "web/src/offline.ts",
    "web/e2e/save-moment.spec.ts",
    "web/android/app/build.gradle",
    "ios/App/Info.plist",
    "factory/config.json",
    "policy/agents/change_policy.rego",
    "web/package-lock.json",
    "docs/factory/policy-exceptions.json",
    "web/src/auth/token.ts",
    ".env",
    "backend/.env",
    "README.md",
    "web/capacitor.config.ts",
]


@unittest.skipUnless(shutil.which("opa"), "opa is not installed; the option A proof did not run")
class OptionAProposal(unittest.TestCase):
    def test_proposal_rego_tests_pass(self):
        proc = subprocess.run(["opa", "test", str(PROPOSAL_DIR), "-v"], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)

    def test_python_enforcement_agrees_with_the_rego_decision_on_every_path(self):
        policy = parse_policy(PROPOSAL.read_text(encoding="utf-8"))
        mismatches = []
        for path in PATHS:
            python_allows = not change_violations([path], policy, ())
            with tempfile.TemporaryDirectory() as tmp:
                input_file = Path(tmp) / "input.json"
                input_file.write_text(
                    json.dumps({"actor": {"type": "agent", "id": "x"}, "changes": [{"path": path, "op": "modify"}], "approvals": []})
                )
                proc = subprocess.run(
                    ["opa", "eval", "-d", str(PROPOSAL), "-i", str(input_file), "data.journal.agents.change.allow", "--format", "json"],
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(proc.returncode, 0, proc.stderr)
                rego_allows = json.loads(proc.stdout)["result"][0]["expressions"][0]["value"] is True
            if python_allows != rego_allows:
                mismatches.append(f"{path}: python={python_allows} rego={rego_allows}")
        self.assertEqual(mismatches, [])


if __name__ == "__main__":
    unittest.main()
