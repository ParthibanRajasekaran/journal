"""Digest-bound exceptions to protected paths. Real git repositories in temporary directories."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from factory.common import FactoryError
from factory.protected_exceptions import approved_file_digests, diff_digest, exempted_paths, scope_violations
from factory.scope import check_scope

KEY = "protected_file_exceptions"

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
    return json.dumps({"exceptions": [], KEY: entries}, indent=2)




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




class FailClosed(unittest.TestCase):
    """Malformed or unusual approvals never pass the run and never exempt a file they do not validly name."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        git(self.repo, "init", "-q")
        self.base0 = write_commit(self.repo, {OPENAPI: "paths: {}\n", APPROVALS: approvals([])}, "base")
        self.candidate = write_commit(self.repo, {OPENAPI: REVIEWED}, "candidate")
        self.digest = diff_digest(self.repo, self.base0, self.candidate, OPENAPI)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def base_with(self, text: str) -> str:
        git(self.repo, "checkout", "-q", self.base0)
        return write_commit(self.repo, {APPROVALS: text}, "approvals under test")

    def entry(self, **overrides) -> dict:
        data = {"path": OPENAPI, "diff_sha256": self.digest, "status": "approved", "approved_by": "owner-name"}
        data.update(overrides)
        return data

    def test_malformed_json_stops_the_run(self) -> None:
        base = self.base_with("{not json")
        with self.assertRaises(FactoryError):
            exempted_paths(self.repo, base, self.candidate, [OPENAPI], PROTECTED)

    def test_a_non_object_top_level_stops_the_run(self) -> None:
        base = self.base_with("[]")
        with self.assertRaises(FactoryError):
            approved_file_digests(self.repo, base)

    def test_a_non_object_entry_stops_the_run(self) -> None:
        base = self.base_with(json.dumps({KEY: ["not an object"]}))
        with self.assertRaises(FactoryError):
            approved_file_digests(self.repo, base)

    def test_two_different_approved_digests_for_one_path_stop_the_run(self) -> None:
        base = self.base_with(approvals([self.entry(), self.entry(diff_sha256="0" * 64)]))
        with self.assertRaises(FactoryError):
            approved_file_digests(self.repo, base)

    def test_an_entry_for_the_approvals_file_is_never_honoured(self) -> None:
        base = self.base_with(approvals([self.entry(path=APPROVALS)]))
        self.assertEqual(approved_file_digests(self.repo, base), {})

    def test_an_approved_entry_with_a_malformed_digest_stops_the_run(self) -> None:
        base = self.base_with(approvals([self.entry(diff_sha256="not-a-digest")]))
        with self.assertRaises(FactoryError):
            approved_file_digests(self.repo, base)

    def test_an_unapproved_entry_with_a_malformed_digest_is_ignored(self) -> None:
        base = self.base_with(approvals([self.entry(diff_sha256="not-a-digest", status="pending-owner-approval")]))
        self.assertEqual(approved_file_digests(self.repo, base), {})

    def test_status_is_matched_exactly(self) -> None:
        base = self.base_with(approvals([self.entry(status="Approved")]))
        self.assertEqual(approved_file_digests(self.repo, base), {})

    def test_a_missing_approver_is_ignored(self) -> None:
        data = self.entry()
        del data["approved_by"]
        base = self.base_with(approvals([data]))
        self.assertEqual(approved_file_digests(self.repo, base), {})

    def test_a_wrong_shaped_policy_approvals_file_stops_the_run(self) -> None:
        from factory.policy_gate import approved_prefixes

        base = self.base_with('{"exceptions": ["x"]}')
        with self.assertRaises(FactoryError):
            approved_prefixes(self.repo, base)

    def test_an_approval_for_a_policy_protected_path_is_still_refused_by_the_policy_gate(self) -> None:
        # The exemption only ever removes the project's scope message. Policy refusals are separate and remain.
        from factory.policy_gate import change_violations, PolicyLists

        base = self.base_with(approvals([self.entry(path="docs/adr/0001.md")]))
        policy = PolicyLists(allowed=("docs/**",), protected=("docs/adr/**",))
        problems = change_violations(["docs/adr/0001.md"], policy, ())
        self.assertTrue(any("protected path changed" in p for p in problems))
        self.assertEqual(exempted_paths(self.repo, base, self.candidate, ["docs/adr/0001.md"], ["docs/adr/**"]), set())




class ScopeWithExemption(unittest.TestCase):
    """The controller's scope check, with the exemption applied. An exempt path is still subject to the ticket's allowed paths."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        git(self.repo, "init", "-q")
        self.base0 = write_commit(self.repo, {OPENAPI: "paths: {}\n", APPROVALS: approvals([])}, "base")
        self.candidate = write_commit(self.repo, {OPENAPI: REVIEWED}, "candidate")
        self.digest = diff_digest(self.repo, self.base0, self.candidate, OPENAPI)
        git(self.repo, "checkout", "-q", self.base0)
        self.base = write_commit(
            self.repo,
            {APPROVALS: approvals([{"path": OPENAPI, "diff_sha256": self.digest, "status": "approved",
                                    "approved_by": "owner-name", "ticket_id": "JRN-OUTBOX-001"}])},
            "approval",
        )

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def scope(self, allowed: list[str], ticket_id: str | None = "JRN-OUTBOX-001") -> list[str]:
        return scope_violations(self.repo, self.base, self.candidate, [OPENAPI], allowed, PROTECTED, ticket_id)

    def test_an_exempt_path_outside_the_ticket_allowed_paths_is_still_refused(self) -> None:
        self.assertEqual(self.scope(["web/src/**"]), [f"outside the ticket's allowed paths: {OPENAPI}"])

    def test_an_exempt_path_the_ticket_allows_passes(self) -> None:
        self.assertEqual(self.scope(["docs/openapi.yaml"]), [])

    def test_an_entry_bound_to_another_ticket_does_not_exempt(self) -> None:
        self.assertEqual(
            self.scope(["docs/openapi.yaml"], ticket_id="JRN-OTHER-002"),
            [f"protected path changed: {OPENAPI}"],
        )

    def test_the_digest_does_not_depend_on_local_diff_settings(self) -> None:
        git(self.repo, "config", "diff.noprefix", "true")
        git(self.repo, "config", "diff.mnemonicPrefix", "true")
        git(self.repo, "config", "core.abbrev", "7")
        git(self.repo, "config", "diff.algorithm", "histogram")
        git(self.repo, "config", "diff.context", "9")
        git(self.repo, "config", "diff.external", "/bin/false")
        git(self.repo, "config", "diff.openapi.textconv", "/bin/false")
        git(self.repo, "config", "diff.interHunkContext", "5")
        self.assertEqual(diff_digest(self.repo, self.base0, self.candidate, OPENAPI), self.digest)



if __name__ == "__main__":
    unittest.main()
