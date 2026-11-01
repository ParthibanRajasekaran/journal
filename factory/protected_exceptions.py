"""Digest-bound exceptions to one protected file, per ticket. Reusable for the identical diff until retired.

What an approval grants: the owner approves, at a base commit, one protected path and the SHA-256 of that path's diff
between the base and a candidate. The factory exempts that path only while the candidate's diff for it has that digest,
and only if the ticket also allows the path.

What it is bound to: the path and the digest, and optionally one ticket. An entry with a "ticket_id" applies only to that
ticket. An entry without one applies to any ticket whose candidate produces the identical diff, until the entry is changed
or removed on the base. Nothing counts uses, so an entry without a ticket is not single-use. Use a ticket_id to limit it.

What it cannot do:
- It never exempts a policy-level refusal. policy_gate.change_violations still refuses protected policy globs, and it always
  refuses the approvals file. Only the project's "protected path changed" scope message can be exempted.
- It never exempts the approvals file itself (APPROVALS_PATH), whatever an entry says.
- It never exempts a path other than the one named, or a diff whose digest differs.
- It never exempts a path the ticket does not allow.

Approvals are read from the base commit, so a candidate cannot approve its own change. Malformed approval data raises
FactoryError, which stops the run, including an approved entry whose digest is malformed. Entries that are unapproved,
unnamed, or for another ticket are ignored.

The digest pins the git settings that change diff output (see diff_digest), and removes the environment variables that
change it. Attribute-driven diff drivers are not pinned. The digest is computed in the repository the factory runs in, not
in a candidate's worktree, so the effect of a candidate's own attributes is not established by this module. Only a binary
attribute set in the factory's repository has been shown to change the digest, and it does so in the fail-closed direction.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

from factory import gitops
from factory.common import FactoryError
from factory.policy_gate import APPROVALS_PATH, read_at
from factory.scope import check_scope, matches

KEY = "protected_file_exceptions"
# Environment variables that change how git renders a diff, or which objects it reads. Removed for the digest.
_DIFF_ENV = {"GIT_DIFF_OPTS", "GIT_EXTERNAL_DIFF", "GIT_NO_REPLACE_OBJECTS", "GIT_DIFF_PATH_COUNTER"}
_DIGEST = re.compile(r"[0-9a-f]{64}")


def approved_file_digests(repo: Path, base: str, ticket_id: str | None = None) -> dict[str, str]:
    """Path -> digest for each exception the owner approved at the base commit.

    Malformed data raises FactoryError. Entries that are not approved, have no named approver, name the approvals
    file, or carry a malformed digest are ignored. Two different approved digests for one path raise FactoryError.
    """
    text = read_at(repo, base, APPROVALS_PATH)
    if text is None:
        return {}
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise FactoryError(f"{APPROVALS_PATH} is not valid JSON at {base[:12]}") from exc
    if not isinstance(data, dict):
        raise FactoryError(f"{APPROVALS_PATH} must be a JSON object at {base[:12]}")
    entries = data.get(KEY, [])
    if not isinstance(entries, list):
        raise FactoryError(f"{KEY} must be a list at {base[:12]}")
    approved: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise FactoryError(f"every entry in {KEY} must be an object at {base[:12]}")
        path, digest = entry.get("path"), entry.get("diff_sha256")
        if entry.get("status") != "approved":
            continue
        if not (isinstance(entry.get("approved_by"), str) and entry["approved_by"].strip()):
            continue
        # An approved entry with a malformed digest is an error, not a silent no-op.
        if not (isinstance(path, str) and isinstance(digest, str) and _DIGEST.fullmatch(digest)):
            raise FactoryError(f"approved entry for {path!r} has a malformed diff_sha256 at {base[:12]}")
        if path == APPROVALS_PATH:
            continue
        # An entry may name one ticket. Such an entry never applies to another ticket.
        if "ticket_id" in entry and entry["ticket_id"] != ticket_id:
            continue
        if path in approved and approved[path] != digest:
            raise FactoryError(f"conflicting approved digests for {path} at {base[:12]}")
        approved[path] = digest
    return approved


def diff_digest(repo: Path, base: str, head: str, path: str) -> str:
    """SHA-256 of the diff for one path between two commits.

    The options are pinned, so the digest does not depend on local git configuration: literal pathspecs, no textconv,
    a fixed diff algorithm and context, full object ids, fixed a/ and b/ prefixes, and no rename detection. The owner computes the digest with this same function.
    """
    # Environment overrides that change diff output are removed, so the digest cannot be changed from outside.
    env = {k: v for k, v in os.environ.items() if k not in _DIFF_ENV}
    try:
        result = subprocess.run(
        [
            "git", "--literal-pathspecs",
            "-c", "diff.noprefix=false",
            "-c", "diff.mnemonicPrefix=false",
            "-c", "core.quotePath=true",
            "-c", "diff.suppressBlankEmpty=false",
            "-c", "diff.relative=false",
            "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--full-index",
            "--diff-algorithm=myers", "--unified=3", "--inter-hunk-context=0",
            "--indent-heuristic", "--src-prefix=a/", "--dst-prefix=b/", "--no-renames",
            base, head, "--", path,
        ],
        cwd=repo, check=True, capture_output=True, env=env,
    )
    except (subprocess.CalledProcessError, OSError) as exc:
        raise FactoryError(f"cannot compute the diff digest for {path} between {base[:12]} and {head[:12]}") from exc
    # Hashed as bytes: no decoding, so a non-UTF-8 byte in the diff cannot crash the run, and no newline translation.
    return hashlib.sha256(result.stdout).hexdigest()


def exempted_paths(
    repo: Path, base: str, head: str, changed: list[str], protected: list[str], ticket_id: str | None = None
) -> set[str]:
    """Protected paths in this change whose exact diff the owner approved. Everything else stays refused."""
    approved = approved_file_digests(repo, base, ticket_id)
    exempt: set[str] = set()
    for path in changed:
        if path == APPROVALS_PATH or not matches(path, protected) or path not in approved:
            continue
        if diff_digest(repo, base, head, path) == approved[path]:
            exempt.add(path)
    return exempt


def scope_violations(
    repo: Path,
    base: str,
    head: str,
    changed: list[str],
    allowed: list[str],
    protected: list[str],
    ticket_id: str | None,
) -> list[str]:
    """The controller's scope check, with the exemption applied.

    An exempt path is still subject to the ticket's allowed paths. The exemption removes only the protected-path
    message, and never removes an "outside the ticket's allowed paths" message.
    """
    violations = check_scope(changed, allowed, protected)
    exempt = exempted_paths(repo, base, head, changed, protected, ticket_id)
    kept = [v for v in violations if not any(v == f"protected path changed: {p}" for p in exempt)]
    for path in sorted(exempt):
        if not matches(path, allowed):
            kept.append(f"outside the ticket's allowed paths: {path}")
    return kept
