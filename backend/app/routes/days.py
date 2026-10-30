"""Day and week summaries: totals over meals the signed-in user owns.

Days are UTC calendar days. A meal belongs to the day of its eaten_at time in UTC.
"""

from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import select

from app.auth.deps import CurrentUserId, SessionDep
from app.db.models import Meal, User
from app.routes.meals import _meal_out

router = APIRouter(tags=["Days"])
TOTAL_FIELDS = ("calories", "protein_g", "carbs_g", "fat_g")


def _totals(day: date, meals: list[Meal]) -> dict[str, Any]:
    sums: dict[str, Decimal] = {field: Decimal("0") for field in TOTAL_FIELDS}
    for meal in meals:
        for field in TOTAL_FIELDS:
            sums[field] += getattr(meal, field)
    return {
        "date": day.isoformat(),
        "calories": float(sums["calories"]),
        "protein_g": float(sums["protein_g"]),
        "carbs_g": float(sums["carbs_g"]),
        "fat_g": float(sums["fat_g"]),
        "meal_count": len(meals),
    }


MIN_DAY = date(1900, 1, 1)
MAX_DAY = date(2999, 12, 31)


def _check_range(day: date) -> None:
    """Dates outside a sensible range are refused, so day arithmetic cannot overflow."""
    if not MIN_DAY <= day <= MAX_DAY:
        raise HTTPException(status_code=422, detail="Date must be between 1900 and 2999.")


def _bounds(first: date, last: date) -> tuple[datetime, datetime]:
    lower = datetime.combine(first, time.min, tzinfo=UTC)
    upper = datetime.combine(last + timedelta(days=1), time.min, tzinfo=UTC)
    return lower, upper


@router.get("/days/{date}", operation_id="getDay")
async def get_day(
    day: Annotated[date, Path(alias="date")],
    user_id: CurrentUserId,
    session: SessionDep,
) -> dict[str, Any]:
    _check_range(day)
    lower, upper = _bounds(day, day)
    meals = (
        (
            await session.execute(
                select(Meal)
                .where(Meal.user_id == user_id, Meal.eaten_at >= lower, Meal.eaten_at < upper)
                .order_by(Meal.eaten_at, Meal.id)
            )
        )
        .scalars()
        .all()
    )
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    summary = _totals(day, list(meals))
    summary["meals"] = [_meal_out(meal) for meal in meals]
    summary["targets"] = {
        "calories": user.target_calories,
        "protein_g": float(user.target_protein_g) if user.target_protein_g is not None else None,
    }
    return summary


@router.get("/week", operation_id="getWeek")
async def get_week(
    user_id: CurrentUserId,
    session: SessionDep,
    start: Annotated[date, Query()],
) -> list[dict[str, Any]]:
    _check_range(start)
    days = [start + timedelta(days=offset) for offset in range(7)]
    lower, upper = _bounds(days[0], days[-1])
    meals = (
        (
            await session.execute(
                select(Meal).where(
                    Meal.user_id == user_id, Meal.eaten_at >= lower, Meal.eaten_at < upper
                )
            )
        )
        .scalars()
        .all()
    )
    by_day: dict[date, list[Meal]] = defaultdict(list)
    for meal in meals:
        by_day[meal.eaten_at.astimezone(UTC).date()].append(meal)
    return [_totals(day, by_day[day]) for day in days]
