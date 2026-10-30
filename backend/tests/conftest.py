from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings
from app.main import create_app
from tests.dbsupport import test_database_url

# 32 fixed bytes, for tests only. Production keys are generated on the server.
TEST_KEY_B64 = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        jwt_secret=SecretStr("test-secret-that-is-at-least-32-characters-long"),
        google_client_id="test-client.apps.googleusercontent.com",
        google_client_secret=SecretStr("test-client-secret"),
        database_url=test_database_url(),
        cookie_secure=False,
        key_encryption_key=SecretStr(TEST_KEY_B64),
    )


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
