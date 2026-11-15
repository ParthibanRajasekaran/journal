from pathlib import Path

import pytest
import yaml

from tests.composesupport import compose_config_error

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
    assert compose_config_error(COMPOSE) is None
