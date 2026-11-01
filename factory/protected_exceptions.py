"""One-time, digest-bound exceptions to the project's protected paths.

A protected path is refused even when a ticket allows it. An owner can lift the refusal for one file, but only
for the exact change they reviewed. The approval records the file path and the SHA-256 of that file's diff
against the base commit. The factory exempts the path only while the candidate's diff for it still has that digest.
Any other change to the same file is refused again.

Approvals are read from the base commit, like every other approval, so a candidate cannot approve its own change.
The approvals file is protected in every run (policy_gate.APPROVALS_PATH).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from factory import gitops
from factory.policy_gate import APPROVALS_PATH, read_at
from factory.scope import matches

KEY = "protected_file_exceptions"


def approved_file_digests(repo: Path, base: str) -> dict[str, str]:
    """Path -> digest for each exception the owner approved at the base commit. Pending entries are ignored."""
    text = read_at(repo, base, APPROVALS_PATH)
    if text is None:
        return {}
    data = json.loads(text)
    approved: dict[str, str] = {}
    for entry in data.get(KEY, []):
        path, digest = entry.get("path"), entry.get("diff_sha256")
        if (
            entry.get("status") == "approved"
            and isinstance(entry.get("approved_by"), str)
            and entry["approved_by"].strip()
            and isinstance(path, str)
            and isinstance(digest, str)
        ):
            approved[path] = digest
    return approved


def diff_digest(repo: Path, base: str, head: str, path: str) -> str:
    """SHA-256 of the diff for one path between two commits. The same command is used to approve and to check."""
    text = gitops.git(repo, "diff", "--no-ext-diff", "--no-color", base, head, "--", path)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def exempted_paths(repo: Path, base: str, head: str, changed: list[str], protected: list[str]) -> set[str]:
    """Protected paths in this change whose exact diff the owner approved. Everything else stays refused."""
    approved = approved_file_digests(repo, base)
    exempt: set[str] = set()
    for path in changed:
        if not matches(path, protected) or path not in approved:
            continue
        if diff_digest(repo, base, head, path) == approved[path]:
            exempt.add(path)
    return exempt
