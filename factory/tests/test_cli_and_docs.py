"""The documented commands must be the real commands. These tests parse every `python3 -m factory`
line in the runbook through the real argument parser, and check that the doctor survives missing tools."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import unittest
from pathlib import Path

from factory.cli import build_parser

REPO = Path(__file__).resolve().parents[2]
RUNBOOK = REPO / "docs" / "factory" / "runbook.md"
PLACEHOLDERS = {
    "TICKET": "factory/tickets/journal-offline-outbox.json",
    "RUN": "run-20261031-example",
    "REF": "HEAD",
}


def documented_commands() -> list[str]:
    text = RUNBOOK.read_text(encoding="utf-8")
    found = []
    for match in re.finditer(r"python3 -m factory ([^`\n]+)", text):
        command = match.group(1).strip().rstrip(".,;:")
        command = re.sub(r"\[([^\]]+)\]", r"\1", command)  # `[--json]` documents an optional flag
        for name, value in PLACEHOLDERS.items():
            command = command.replace(name, value)
        found.append(command)
    return found


class DocumentedCommands(unittest.TestCase):
    def test_the_runbook_documents_commands(self):
        self.assertGreaterEqual(len(documented_commands()), 10)

    def test_every_documented_command_parses_with_the_real_parser(self):
        parser = build_parser()
        for command in documented_commands():
            with self.subTest(command=command):
                # argparse exits on a syntax error; a SystemExit here means the docs and the CLI disagree.
                parser.parse_args(command.split())

    def test_json_is_accepted_after_the_subcommand_and_before_it(self):
        parser = build_parser()
        self.assertTrue(parser.parse_args(["doctor", "--json"]).json)
        self.assertTrue(parser.parse_args(["--json", "doctor"]).json)
        self.assertFalse(parser.parse_args(["doctor"]).json)


class DoctorTolerance(unittest.TestCase):
    def test_doctor_finishes_when_no_executable_can_be_found(self):
        env = {"PATH": "", "HOME": os.environ.get("HOME", "/tmp")}
        proc = subprocess.run(
            [sys.executable, "-m", "factory", "doctor"],
            cwd=REPO,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertNotIn("Traceback", proc.stderr)
        self.assertIn("postgresql-5433", proc.stdout)
        self.assertIn("pg_isready not on PATH", proc.stdout)


if __name__ == "__main__":
    unittest.main()
