import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

pytestmark = pytest.mark.m0

COMPOSE = Path(__file__).resolve().parents[2] / "docker" / "compose.yaml"


def test_api_waits_for_the_migrate_one_shot() -> None:
    services = yaml.safe_load(COMPOSE.read_text())["services"]
    assert services["migrate"]["command"] == ["alembic", "upgrade", "head"]
    assert services["migrate"]["restart"] == "no"
    assert services["api"]["depends_on"]["migrate"] == {
        "condition": "service_completed_successfully"
    }
    # Same image, environment and database for both, so migrate runs against what api serves.
    assert services["migrate"]["build"] == services["api"]["build"]
    assert services["migrate"]["environment"] == services["api"]["environment"]


def test_compose_file_parses() -> None:
    docker = shutil.which("docker")
    if docker is None:
        pytest.fail("docker is required to check the compose file")
    result = subprocess.run(  # noqa: S603 - fixed argv, no untrusted input
        [docker, "compose", "-f", str(COMPOSE), "config", "--quiet"],
        env={"POSTGRES_PASSWORD": "test", "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
