"""Git isolation. Each run works in its own worktree on its own branch. Worktrees are not a security
sandbox; they only stop concurrent runs from colliding in one working tree."""

from __future__ import annotations

import subprocess
from pathlib import Path

from factory.common import FactoryError

IDENTITY = ["-c", "user.name=factory", "-c", "user.email=factory@localhost"]


def git(cwd: Path, *args: str, check: bool = True) -> str:
    proc = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise FactoryError(f"git {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def repo_root(start: Path) -> Path:
    return Path(git(Path(start), "rev-parse", "--show-toplevel").strip())


def resolve(repo: Path, ref: str) -> str:
    out = git(repo, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}", check=False).strip()
    if not out:
        raise FactoryError(f"unknown commit: {ref}")
    return out


def head(workdir: Path) -> str:
    return git(workdir, "rev-parse", "HEAD").strip()


def add_worktree(repo: Path, path: Path, branch: str, start: str) -> None:
    git(repo, "worktree", "add", "-b", branch, str(path), start)


def remove_worktree(repo: Path, path: Path) -> None:
    git(repo, "worktree", "remove", "--force", str(path), check=False)


def link_dependencies(repo: Path, workdir: Path, relative_dirs: list[str]) -> None:
    """Shares installed dependencies from the main checkout. They are not tracked by git."""
    for rel in relative_dirs:
        source = repo / rel
        target = workdir / rel
        if source.exists() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.symlink_to(source, target_is_directory=True)


def changed_paths(workdir: Path, base: str) -> list[str]:
    out = git(workdir, "diff", "--name-only", "--no-renames", f"{base}..HEAD")
    return [line for line in out.splitlines() if line]


def diff_text(workdir: Path, base: str, limit: int = 60_000) -> str:
    text = git(workdir, "diff", "--no-color", f"{base}..HEAD")
    return text if len(text) <= limit else text[:limit] + "\n[diff truncated]"


def commit_all(workdir: Path, message: str) -> str | None:
    """Commits everything the implementer changed. Returns the new SHA, or None if nothing changed."""
    git(workdir, "add", "-A")
    if not git(workdir, "status", "--porcelain").strip():
        return None
    git(workdir, *IDENTITY, "commit", "-q", "-m", message)
    return head(workdir)


def dirty_entries(workdir: Path) -> list[str]:
    """Every tracked change and every untracked (not ignored) file, as `git status` reports them."""
    out = git(workdir, "status", "--porcelain", "--untracked-files=all")
    return [line for line in out.splitlines() if line.strip()]


def entry_path(line: str) -> str:
    return line[3:].strip().strip('"')


def relevant_dirty(workdir: Path, patterns: list[str]) -> list[str]:
    """Uncommitted changes that a candidate would depend on: any tracked change, or an untracked file
    under one of the given patterns. Unrelated untracked notes are ignored."""
    from factory.scope import matches

    relevant = []
    for line in dirty_entries(workdir):
        path = entry_path(line)
        tracked = not line.startswith("??")
        if tracked or matches(path, patterns):
            relevant.append(line)
    return relevant


def snapshot(workdir: Path) -> dict:
    """Identity of a worktree's committed and uncommitted state. Compared before and after gates and review."""
    return {
        "head": head(workdir),
        "tree": git(workdir, "rev-parse", "HEAD^{tree}").strip(),
        "dirty": dirty_entries(workdir),
    }
