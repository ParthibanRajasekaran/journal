import shutil
from pathlib import Path

import pytest
import yaml

from tests.composesupport import compose_config_error

pytestmark = pytest.mark.m0

BETA_DIR = Path(__file__).resolve().parents[2] / "docker" / "beta"
BETA = yaml.safe_load((BETA_DIR / "compose.yaml").read_text())


def test_beta_is_its_own_project_with_its_own_data() -> None:
    assert BETA["name"] == "journal-beta"
    assert set(BETA["services"]) == {"api", "migrate", "postgres"}
    assert BETA["volumes"] == {"pgdata_beta": None}
    assert BETA["services"]["postgres"]["volumes"] == ["pgdata_beta:/var/lib/postgresql"]
    assert "ports" not in BETA["services"]["postgres"]


def test_beta_secrets_come_from_an_uncommitted_env_file() -> None:
    assert BETA["services"]["api"]["env_file"] == ["./.env.beta"]
    ignored = (Path(__file__).resolve().parents[2] / ".gitignore").read_text().splitlines()
    assert ".env*" in ignored


def test_beta_api_waits_for_migrate_and_only_the_api_is_on_the_shared_network() -> None:
    services = BETA["services"]
    assert services["api"]["depends_on"]["migrate"] == {
        "condition": "service_completed_successfully"
    }
    assert services["migrate"]["command"] == ["alembic", "upgrade", "head"]
    assert set(services["api"]["networks"]) == {"internal", "beta_edge"}
    assert services["postgres"]["networks"] == ["internal"]
    assert BETA["networks"]["beta_edge"] == {"external": True}


def test_beta_is_a_release_configuration() -> None:
    environment = BETA["services"]["api"]["environment"]
    assert environment["JOURNAL_ENVIRONMENT"] == "production"
    assert environment["JOURNAL_PUBLIC_BASE_URL"].startswith("https://")


def test_caddy_site_block_proxies_the_beta_api_only() -> None:
    site = (BETA_DIR / "Caddyfile.beta-site").read_text()
    assert site.startswith("# PROPOSAL, NOT ACTIVATED")
    assert "beta.journal.getrendercheck.com {" in site
    assert "reverse_proxy journal-beta-api:8000" in site


def test_beta_compose_files_parse(tmp_path: Path) -> None:
    # The real .env.beta never exists in the repository, so parse a copy beside a placeholder.
    shutil.copy(BETA_DIR / "compose.yaml", tmp_path / "compose.yaml")
    (tmp_path / ".env.beta").write_text("")
    assert compose_config_error(tmp_path / "compose.yaml") is None
