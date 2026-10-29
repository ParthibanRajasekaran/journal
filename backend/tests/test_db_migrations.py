"""Migrations must build the schema the models describe, and must be reversible."""

from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db import models  # noqa: F401  (registers the tables on Base.metadata)
from app.db.base import Base
from tests.dbsupport import migrate_to_base, migrate_to_head, run


def test_head_creates_users_and_meals() -> None:
    migrate_to_head()

    async def tables(engine: AsyncEngine) -> set[str]:
        async with engine.connect() as conn:
            names: set[str] = await conn.run_sync(lambda sync: set(inspect(sync).get_table_names()))
        return names

    names = run(tables)
    assert {"users", "meals"} <= names


def test_models_match_migrations() -> None:
    """Autogenerate must find no difference between the models and the database."""
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    migrate_to_head()

    async def differences(engine: AsyncEngine) -> list[object]:
        async with engine.connect() as conn:
            return await conn.run_sync(
                lambda sync: compare_metadata(
                    MigrationContext.configure(sync, opts={"compare_type": True}),
                    Base.metadata,
                )
            )

    assert run(differences) == []


def test_downgrade_then_upgrade_round_trip() -> None:
    migrate_to_head()
    migrate_to_base()

    async def tables(engine: AsyncEngine) -> set[str]:
        async with engine.connect() as conn:
            names: set[str] = await conn.run_sync(lambda sync: set(inspect(sync).get_table_names()))
        return names

    assert "meals" not in run(tables)
    migrate_to_head()
    assert {"users", "meals"} <= run(tables)
