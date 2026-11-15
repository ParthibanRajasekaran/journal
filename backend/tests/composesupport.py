"""Run `docker compose config` on a file, so a malformed stack fails a test, not a deploy."""

import secrets
import shutil
import subprocess  # nosec B404 - fixed argv below, no untrusted input
from pathlib import Path


def compose_config_error(compose_file: Path) -> str | None:
    """Return docker's error text if the file does not parse, or None if it does."""
    docker = shutil.which("docker")
    if docker is None:
        raise AssertionError("docker is required to check the compose file")
    result = subprocess.run(  # noqa: S603  # nosec B603 - fixed argv, no untrusted input
        [docker, "compose", "-f", str(compose_file), "config", "--quiet"],
        env={
            "POSTGRES_PASSWORD": secrets.token_hex(8),
            "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    return None if result.returncode == 0 else result.stderr
