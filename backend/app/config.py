"""Runtime settings, read from environment variables prefixed JOURNAL_.

No secrets have a default. Anything secret must be supplied by the host
environment (see ADR-002), never committed.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JOURNAL_", extra="forbid")

    environment: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    problem_type_base: str = "https://journal.example/problems/"


@lru_cache
def get_settings() -> Settings:
    return Settings()
