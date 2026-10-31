"""Workspace ownership. One controller at a time may write a run's worktree, ledger rows and handoffs.

An OS file lock (fcntl.flock) is held for the whole controller operation. It is released by the OS if
the process dies, so a crash cannot leave a stale lock that needs manual deletion. The lock file names
the holder's pid for the operator; it is informational, not the ownership check itself.
"""

from __future__ import annotations

import fcntl
import os
from pathlib import Path

from factory.common import FactoryError


class WorkspaceHeld(FactoryError):
    pass


class WorkspaceLock:
    def __init__(self, lock_dir: Path, run_id: str):
        self.path = Path(lock_dir) / f"{run_id}.lock"
        self._fh = None

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fh = open(self.path, "a+")
        try:
            fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            fh.seek(0)
            holder = fh.read().strip() or "another process"
            fh.close()
            raise WorkspaceHeld(f"run is held by {holder}; only one controller may write a run at a time") from None
        fh.seek(0)
        fh.truncate()
        fh.write(f"pid {os.getpid()}\n")
        fh.flush()
        self._fh = fh
        return self

    def __exit__(self, *exc):
        if self._fh is not None:
            fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
            self._fh.close()
            self._fh = None
        return False
