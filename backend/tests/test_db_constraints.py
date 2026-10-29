"""The database must refuse invalid rows, even if application code has a bug."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import delete, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.db.models import Meal, User
from tests.dbsupport import migrate_to_head, run, truncate_all

EATEN = datetime(2026, 10, 29, 8, 12, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _fresh_schema() -> None:
    migrate_to_head()
    run(truncate_all)


def _user(google_sub: str = "sub-1", **extra: Any) -> dict[str, Any]:
    return {"google_sub": google_sub, "email": "person@example.com", **extra}


def _meal(user_id: str, **overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "user_id": user_id,
        "client_id": uuid.uuid4(),
        "meal_type": "breakfast",
        "eaten_at": EATEN,
        "name": "Oatmeal with banana",
        "calories": Decimal("352.0"),
        "protein_g": Decimal("11.8"),
        "carbs_g": Decimal("61.0"),
        "fat_g": Decimal("6.2"),
        "source": "ai_confirmed",
    }
    values.update(overrides)
    return values


async def _add_user(conn: AsyncConnection, **extra: Any) -> str:
    result = await conn.execute(insert(User).values(**_user(**extra)).returning(User.id))
    return str(result.scalar_one())


def test_valid_meal_is_stored_with_generated_id() -> None:
    async def go(engine: AsyncEngine) -> str:
        async with engine.begin() as conn:
            user_id = await _add_user(conn)
            result = await conn.execute(insert(Meal).values(**_meal(user_id)).returning(Meal.id))
            return str(result.scalar_one())

    assert run(go).startswith("meal_")


@pytest.mark.parametrize(
    "overrides",
    [
        {"calories": Decimal("-1")},
        {"calories": Decimal("5001")},
        {"protein_g": Decimal("301")},
        {"carbs_g": Decimal("-0.1")},
        {"fat_g": Decimal("300.1")},
        {"meal_type": "brunch"},
        {"source": "guessed"},
        {"version": 0},
    ],
)
def test_out_of_range_or_unknown_values_are_rejected(overrides: dict[str, Any]) -> None:
    async def go(engine: AsyncEngine) -> None:
        async with engine.begin() as conn:
            user_id = await _add_user(conn)
            await conn.execute(insert(Meal).values(**_meal(user_id, **overrides)))

    with pytest.raises(IntegrityError):
        run(go)


def test_same_client_id_for_one_user_is_rejected() -> None:
    client_id = uuid.uuid4()

    async def go(engine: AsyncEngine) -> None:
        async with engine.begin() as conn:
            user_id = await _add_user(conn)
            await conn.execute(insert(Meal).values(**_meal(user_id, client_id=client_id)))
            await conn.execute(insert(Meal).values(**_meal(user_id, client_id=client_id)))

    with pytest.raises(IntegrityError):
        run(go)


def test_same_client_id_for_two_users_is_allowed() -> None:
    client_id = uuid.uuid4()

    async def go(engine: AsyncEngine) -> int:
        async with engine.begin() as conn:
            for sub in ("sub-a", "sub-b"):
                user_id = await _add_user(conn, google_sub=sub)
                await conn.execute(insert(Meal).values(**_meal(user_id, client_id=client_id)))
            rows = await conn.execute(select(Meal.id))
            return len(rows.all())

    assert run(go) == 2


def test_google_subject_is_unique() -> None:
    async def go(engine: AsyncEngine) -> None:
        async with engine.begin() as conn:
            await _add_user(conn, google_sub="same-sub")
            await _add_user(conn, google_sub="same-sub")

    with pytest.raises(IntegrityError):
        run(go)


def test_target_ranges_are_enforced() -> None:
    async def go(engine: AsyncEngine) -> None:
        async with engine.begin() as conn:
            await _add_user(conn, target_calories=100)

    with pytest.raises(IntegrityError):
        run(go)


def test_deleting_a_user_deletes_their_meals() -> None:
    async def go(engine: AsyncEngine) -> int:
        async with engine.begin() as conn:
            user_id = await _add_user(conn)
            await conn.execute(insert(Meal).values(**_meal(user_id)))
            await conn.execute(delete(User).where(User.id == user_id))
            rows = await conn.execute(select(Meal.id))
            return len(rows.all())

    assert run(go) == 0
