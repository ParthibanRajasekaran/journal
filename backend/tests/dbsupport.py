"""Helpers for database tests. These run against a real PostgreSQL server.

Tests never skip when the database is down: an unreachable server is a failure,
so the gate cannot pass without exercising the schema.
"""

import asyncio
import os
from collections.abc import Awaitable, Callable
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import Settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_TEST_URL = "postgresql+asyncpg://127.0.0.1:5433/journal_test"


def test_database_url() -> str:
    return os.environ.get("JOURNAL_TEST_DATABASE_URL", DEFAULT_TEST_URL)


def make_settings() -> Settings:
    return Settings(environment="test", database_url=test_database_url())


def alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", test_database_url())
    return cfg


def migrate_to_head() -> None:
    command.upgrade(alembic_config(), "head")


def migrate_to_base() -> None:
    command.downgrade(alembic_config(), "base")


def run[T](operation: Callable[[AsyncEngine], Awaitable[T]]) -> T:
    """Run one async database operation on a fresh engine that is disposed afterwards."""

    async def _go() -> T:
        engine = create_async_engine(test_database_url(), poolclass=NullPool)
        try:
            return await operation(engine)
        finally:
            await engine.dispose()

    return asyncio.run(_go())


async def truncate_all(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE meals, users RESTART IDENTITY CASCADE"))
