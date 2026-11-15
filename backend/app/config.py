"""Runtime settings, read from environment variables prefixed JOURNAL_.

Secrets have no defaults. They must come from the host environment or the
server's owner-only .env file (ADR-002, ADR-004), never from the repository.
"""

from functools import lru_cache
from typing import Literal, Self

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JOURNAL_", extra="forbid", env_file=".env")

    environment: Literal["development", "test", "production"] = "development"
    # OTLP/HTTP endpoint of the OpenTelemetry Collector on the internal network.
    # Unset means nothing is exported.
    otel_endpoint: str | None = None
    # Git commit the image was built from (build arg in docker/Dockerfile.api), shown by /version.
    source_sha: str = "unknown"
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

    # Models used for estimates. Check each name against the provider's model list before launch.
    estimate_model_openai: str = "gpt-4o-mini"
    estimate_model_anthropic: str = "claude-haiku-5-5"
    estimate_model_gemini: str = "gemini-2.5-flash"

    # Encrypts stored provider keys. 32 random bytes, base64. Never stored in the database.
    key_encryption_key: SecretStr | None = None

    # Abuse limits (per signed-in user). A burst of this many writes is allowed, then it refills.
    write_requests_per_minute: int = 30
    meals_per_day: int = 300

    @model_validator(mode="after")
    def _production_is_safe(self) -> Self:
        """A production process must not start with insecure cookies or without a signing secret."""
        if self.environment == "production":
            if not self.cookie_secure:
                raise ValueError("JOURNAL_COOKIE_SECURE must be true in production")
            if self.jwt_secret is None or not self.jwt_secret.get_secret_value():
                raise ValueError("JOURNAL_JWT_SECRET is required in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
