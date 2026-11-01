"""The Journal project defines backend gates, and a gate that needs an environment variable fails closed."""

import json
import os
import tempfile
import unittest
from pathlib import Path

from factory.gates import run_gate

REPO = Path(__file__).resolve().parents[2]


class ProjectGates(unittest.TestCase):
    def test_outbox_ticket_verifies_web_and_backend(self):
        ticket = json.loads((REPO / "factory" / "tickets" / "journal-offline-outbox.json").read_text())
        project = json.loads((REPO / "factory" / "projects" / "journal.json").read_text())
        for gate in ticket["verification"]:
            self.assertIn(gate, project["gates"])
        self.assertTrue(any(g.startswith("backend-") for g in ticket["verification"]))
        self.assertTrue(any(g.startswith("web-") for g in ticket["verification"]))

    def test_backend_database_gate_declares_its_required_variable(self):
        project = json.loads((REPO / "factory" / "projects" / "journal.json").read_text())
        self.assertEqual(project["gates"]["backend-tests"]["requires_env"], ["JOURNAL_TEST_DATABASE_URL"])


class MissingEnvironment(unittest.TestCase):
    def test_a_gate_with_a_missing_variable_fails_without_running_its_command(self):
        marker = Path(tempfile.mkdtemp()) / "ran"
        spec = {"cwd": ".", "argv": ["python3", "-c", f"open({str(marker)!r}, 'w').write('x')"],
                "requires_env": ["FACTORY_TEST_ABSENT_VARIABLE"]}
        os.environ.pop("FACTORY_TEST_ABSENT_VARIABLE", None)
        result = run_gate(Path("."), "needs-env", spec, 30)
        self.assertFalse(result["passed"])
        self.assertIn("FACTORY_TEST_ABSENT_VARIABLE", result["output_tail"])
        self.assertFalse(marker.exists(), "the command must not run when a required variable is missing")

    def test_the_variable_value_is_never_printed(self):
        os.environ["FACTORY_TEST_SECRET_VALUE"] = "super-secret-value-123"
        try:
            spec = {"cwd": ".", "argv": ["python3", "-c", "pass"], "requires_env": ["FACTORY_TEST_SECRET_VALUE"]}
            result = run_gate(Path("."), "present", spec, 30)
            self.assertTrue(result["passed"])
            self.assertNotIn("super-secret-value-123", json.dumps(result))
        finally:
            os.environ.pop("FACTORY_TEST_SECRET_VALUE", None)


if __name__ == "__main__":
    unittest.main()
