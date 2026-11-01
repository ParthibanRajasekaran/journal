"""Digest-bound exceptions to one protected file. Reusable for the identical diff until retired. Not single-use.

What an approval grants: the owner approves, at a base commit, one protected path and the SHA-256 of that path's diff
between the base and a candidate. The factory exempts that path only while the candidate's diff for it has that digest.

What it is bound to: the path and the digest. It is not bound to a ticket. Any ticket whose candidate produces the same
diff for the same file, against a base where the approval is present, is exempted. The exception is retired by changing
or removing its entry on the base. Nothing here counts uses, so it is not single-use.

What it cannot do:
- It never exempts a policy-level refusal. policy_gate.change_violations still refuses protected policy globs, and it
  always refuses the approvals file. Only the project's "protected path changed" scope message can be exempted.
- It never exempts the approvals file itself (APPROVALS_PATH), whatever an entry says.
- It never exempts a path other than the one named, and never a diff whose digest differs.

Approvals are read from the base commit, so a candidate cannot approve its own change. Malformed approval data stops the run
with FactoryError, rather than being ignored or passed.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from factory import gitops
from factory.common import FactoryError
from factory.policy_gate import APPROVALS_PATH, read_at
from factory.scope import matches

KEY = "protected_file_exceptions"
_DIGEST = re.compile(r"^[0-9a-f]{64}$")


def approved_file_digests(repo: Path, base: str) -> dict[str, str]:
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
        if not (isinstance(path, str) and isinstance(digest, str) and _DIGEST.match(digest)):
            continue
        if path == APPROVALS_PATH:
            continue
        if path in approved and approved[path] != digest:
            raise FactoryError(f"conflicting approved digests for {path} at {base[:12]}")
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
        if path == APPROVALS_PATH or not matches(path, protected) or path not in approved:
            continue
        if diff_digest(repo, base, head, path) == approved[path]:
            exempt.add(path)
    return exempt
