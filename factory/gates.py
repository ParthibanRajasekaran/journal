"""Deterministic gates. Commands come only from the protected project file, never from the candidate."""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

from factory.common import sha256_text

TAIL_CHARS = 4000


def run_gate(workdir: Path, gate_id: str, spec: dict, default_timeout: int) -> dict:
    cwd = workdir / spec.get("cwd", ".")
    argv = spec["argv"]
    timeout = int(spec.get("timeout", default_timeout))
    started = time.time()
    # A gate that needs a variable fails closed when it is missing. The message names the variable, never its value.
    missing = [name for name in spec.get("requires_env", []) if not os.environ.get(name)]
    if missing:
        output = "missing required environment variable(s): " + ", ".join(missing)
        return {
            "id": gate_id, "argv": argv, "cwd": spec.get("cwd", "."), "exit_code": 78, "passed": False,
            "duration_s": 0.0, "output_sha256": sha256_text(output), "output_tail": output[-TAIL_CHARS:],
        }
    try:
        proc = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        code = proc.returncode
        output = (proc.stdout or "") + (proc.stderr or "")
    except FileNotFoundError:
        code, output = 127, f"command not found: {argv[0]}"
    except subprocess.TimeoutExpired as exc:
        code = 124
        output = (exc.stdout or "") + (exc.stderr or "") if isinstance(exc.stdout, str) else "timed out"
    return {
        "id": gate_id,
        "argv": argv,
        "cwd": spec.get("cwd", "."),
        "exit_code": code,
        "passed": code == 0,
        "duration_s": round(time.time() - started, 2),
        "output_sha256": sha256_text(output),
        "output_tail": output[-TAIL_CHARS:],
    }
