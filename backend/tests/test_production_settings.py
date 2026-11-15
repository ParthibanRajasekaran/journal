import pytest
from pydantic import SecretStr, ValidationError

from app.config import Settings

pytestmark = pytest.mark.m0

SECRET = SecretStr("test-secret-that-is-at-least-32-characters-long")


def test_production_accepts_secure_cookies_and_a_jwt_secret() -> None:
    settings = Settings(environment="production", cookie_secure=True, jwt_secret=SECRET)
    assert settings.environment == "production"


def test_production_refuses_insecure_cookies() -> None:
    with pytest.raises(ValidationError, match="JOURNAL_COOKIE_SECURE"):
        Settings(environment="production", cookie_secure=False, jwt_secret=SECRET)


def test_production_refuses_a_missing_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JOURNAL_JWT_SECRET"):
        Settings(environment="production", cookie_secure=True)


def test_production_refuses_an_empty_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JOURNAL_JWT_SECRET"):
        Settings(environment="production", cookie_secure=True, jwt_secret=SecretStr(""))


def test_development_keeps_its_local_defaults() -> None:
    settings = Settings(environment="development", cookie_secure=False)
    assert settings.jwt_secret is None
