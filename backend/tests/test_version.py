from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.routes.version import migration_head

pytestmark = pytest.mark.m0

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations" / "versions"


def test_version_reports_provenance(settings: Settings) -> None:
    app = create_app(settings.model_copy(update={"source_sha": "abc1234"}))
    with TestClient(app) as client:
        response = client.get("/api/v1/version", headers={})
    assert response.status_code == 200
    assert response.json() == {
        "api_version": "1.0.0-draft",
        "source_sha": "abc1234",
        "migration_head": migration_head(),
        "environment": "test",
    }


def test_version_head_is_a_shipped_revision() -> None:
    head = migration_head()
    assert head is not None
    assert list(MIGRATIONS.glob(f"{head}_*.py"))


def test_source_sha_defaults_to_unknown(client: TestClient) -> None:
    assert client.get("/api/v1/version").json()["source_sha"] == "unknown"
