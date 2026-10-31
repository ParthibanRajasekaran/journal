"""One evidence-integrity routine, used by every verification entry point (normal run and standalone verify).

It checks that the worktree is the expected committed candidate and clean before gates run, and that the
same identity holds after gates and any review. A change in between means the results describe a state that
is not the commit, so the result is refused.

Limit: git snapshots see the tracked and untracked tree. They are not process containment. A gate or reviewer
can still read or write outside the worktree, and this check cannot see that. Containment needs an OS or
container boundary, which the factory does not have.
"""

from __future__ import annotations

from pathlib import Path

from factory import gitops


class EvidenceGuard:
    def __init__(self, workdir: Path, workspace_links: tuple[str, ...], expected_head: str | None):
        self.workdir = Path(workdir)
        self.links = workspace_links
        self.before = gitops.snapshot(self.workdir, self.links)
        self.problems: list[str] = []
        if expected_head is not None and self.before["head"] != expected_head:
            self.problems.append(f"workspace HEAD {self.before['head'][:12]} is not the expected candidate {expected_head[:12]}")
        if self.before["dirty"]:
            self.problems.append("worktree has uncommitted or untracked changes before verification: " + "; ".join(e.strip() for e in self.before["dirty"]))

    @property
    def clean_to_start(self) -> bool:
        return not self.problems

    def finish(self) -> list[str]:
        """Compares the identity again. Returns every problem found, including any from the start."""
        after = gitops.snapshot(self.workdir, self.links)
        problems = list(self.problems)
        if after != self.before:
            problems.append(
                f"candidate changed during verification (head {self.before['head'][:12]} -> {after['head'][:12]}, "
                f"dirty entries {len(after['dirty'])})"
            )
        self.after = after
        return problems
