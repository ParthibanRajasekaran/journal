"""Runtime settings, read from environment variables prefixed JOURNAL_.

Secrets have no defaults. They must come from the host environment or the
server's owner-only .env file (ADR-002, ADR-004), never from the repository.
"""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JOURNAL_", extra="forbid", env_file=".env")

    environment: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    problem_type_base: str = "https://journal.example/problems/"
    # Local development default. Production must set JOURNAL_DATABASE_URL explicitly.
    database_url: str = "postgresql+asyncpg://127.0.0.1:5433/journal_dev"

    # Public OAuth client identifier. Not secret.
    google_client_id: str | None = None
    # OAuth client secret. Held only by the backend (ADR-004).
    google_client_secret: SecretStr | None = None
    # Signs our own tokens. Must be at least 32 characters; checked when auth starts.
    jwt_secret: SecretStr | None = None
    # Public origin of this API, used to build the Google redirect URI.
    public_base_url: str = "http://localhost:8000"
    # Cookies are Secure except in local development over plain HTTP.
    cookie_secure: bool = True

    access_token_ttl_seconds: int = 900
    refresh_token_ttl_days: int = 30
    oauth_state_ttl_seconds: int = 600

    # Encrypts stored provider keys. 32 random bytes, base64. Never stored in the database.
    key_encryption_key: SecretStr | None = None

    # Abuse limits (per signed-in user). A burst of this many writes is allowed, then it refills.
    write_requests_per_minute: int = 30
    meals_per_day: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()
