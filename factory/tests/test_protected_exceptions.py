"""Digest-bound exceptions to protected paths. Real git repositories in temporary directories."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from factory.protected_exceptions import approved_file_digests, diff_digest, exempted_paths
from factory.scope import check_scope

OPENAPI = "docs/openapi.yaml"
APPROVALS = "docs/factory/policy-exceptions.json"
PROTECTED = [OPENAPI]

REVIEWED = "paths:\n  /meals:\n    post:\n      parameters:\n      - $ref: ExpectedAccount  # reviewed header\n"
OTHER = "paths:\n  /meals:\n    post:\n      parameters:\n      - $ref: SomethingUnrelated  # not reviewed\n"


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", *args],
        cwd=repo, check=True, capture_output=True, text=True,
    ).stdout.strip()


def write_commit(repo: Path, files: dict[str, str], message: str) -> str:
    for rel, text in files.items():
        target = repo / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


def approvals(entries: list[dict]) -> str:
    return json.dumps({"exceptions": [], KEY_NAME: entries}, indent=2)


KEY_NAME = "protected_file_exceptions"


class ProtectedFileExceptions(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        git(self.repo, "init", "-q")
        # The base starts with the unreviewed file and no approval.
        self.base0 = write_commit(self.repo, {OPENAPI: "paths: {}\n", APPROVALS: approvals([])}, "base")
        # The candidate makes the reviewed change, on top of that base.
        self.candidate = write_commit(self.repo, {OPENAPI: REVIEWED}, "candidate")
        git(self.repo, "checkout", "-q", self.base0)
        self.digest = diff_digest(self.repo, self.base0, self.candidate, OPENAPI)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def approve_at_base(self, entries: list[dict]) -> str:
        """Records the approval as a new base commit, the way it reaches main: before the candidate is admitted."""
        git(self.repo, "checkout", "-q", self.base0)
        return write_commit(self.repo, {APPROVALS: approvals(entries)}, "owner approval")

    def exempt(self, base: str, head: str, changed: list[str]) -> set[str]:
        return exempted_paths(self.repo, base, head, changed, PROTECTED)

    def test_the_exact_reviewed_diff_is_exempted_once_approved(self) -> None:
        base = self.approve_at_base([{
            "path": OPENAPI, "diff_sha256": self.digest, "status": "approved",
            "approved_by": "owner-name", "reason": "documents X-Journal-Expected-Account",
        }])
        self.assertEqual(self.exempt(base, self.candidate, [OPENAPI]), {OPENAPI})

    def test_the_exemption_removes_only_the_protected_violation_for_that_file(self) -> None:
        base = self.approve_at_base([{
            "path": OPENAPI, "diff_sha256": self.digest, "status": "approved", "approved_by": "owner-name",
        }])
        problems = check_scope([OPENAPI], ["docs/**"], PROTECTED)
        self.assertEqual(problems, [f"protected path changed: {OPENAPI}"])
        self.assertEqual(self.exempt(base, self.candidate, [OPENAPI]), {OPENAPI})

    def test_an_unrelated_change_to_the_same_file_is_still_refused(self) -> None:
        base = self.approve_at_base([{
            "path": OPENAPI, "diff_sha256": self.digest, "status": "approved", "approved_by": "owner-name",
        }])
        other = write_commit(self.repo, {OPENAPI: OTHER}, "unrelated contract change")
        self.assertEqual(self.exempt(base, other, [OPENAPI]), set())

    def test_a_pending_approval_exempts_nothing(self) -> None:
        base = self.approve_at_base([{
            "path": OPENAPI, "diff_sha256": self.digest, "status": "pending-owner-approval", "approved_by": "",
        }])
        self.assertEqual(self.exempt(base, self.candidate, [OPENAPI]), set())

    def test_an_approval_without_a_named_approver_exempts_nothing(self) -> None:
        base = self.approve_at_base([{
            "path": OPENAPI, "diff_sha256": self.digest, "status": "approved", "approved_by": "  ",
        }])
        self.assertEqual(self.exempt(base, self.candidate, [OPENAPI]), set())

    def test_an_approval_for_one_file_does_not_cover_another_protected_file(self) -> None:
        base = self.approve_at_base([{
            "path": OPENAPI, "diff_sha256": self.digest, "status": "approved", "approved_by": "owner-name",
        }])
        self.assertEqual(self.exempt(base, self.candidate, ["docs/prd.md"]), set())

    def test_approvals_are_read_from_the_base_commit_only(self) -> None:
        # The candidate adds its own approval. It is not in the base, so nothing is exempted.
        candidate_with_self_approval = write_commit(
            self.repo,
            {OPENAPI: REVIEWED, APPROVALS: approvals([{
                "path": OPENAPI, "diff_sha256": self.digest, "status": "approved", "approved_by": "candidate",
            }])},
            "candidate adds its own approval",
        )
        self.assertEqual(approved_file_digests(self.repo, self.base0), {})
        self.assertEqual(self.exempt(self.base0, candidate_with_self_approval, [OPENAPI]), set())


if __name__ == "__main__":
    unittest.main()
