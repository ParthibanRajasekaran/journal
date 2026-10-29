"""Async engine and session factory. Built from settings; never at import time."""

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import Settings


def make_engine(settings: Settings) -> AsyncEngine:
    # NullPool: one connection per request. Simple and safe across event loops; revisit under load.
    return create_async_engine(settings.database_url, poolclass=NullPool)


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker:  # type: ignore[type-arg]
    return async_sessionmaker(engine, expire_on_commit=False)
