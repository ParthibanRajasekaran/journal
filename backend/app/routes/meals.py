"""Meals: owner-only reads and writes, idempotent creates, and version checks on edits.

Every query filters by the signed-in user. A meal that belongs to someone else is reported
as not found, so the API does not reveal which IDs exist (ADR-006 authorization layer).
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Header, HTTPException, Path, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.auth.deps import CurrentUserId, SessionDep, require_write
from app.db.models import Meal

router = APIRouter(tags=["Meals"])

MealType = Literal["breakfast", "lunch", "dinner", "snack"]
MealSource = Literal["ai_confirmed", "ai_edited", "manual"]
PHOTO_ID_PATTERN = r"^ph_[0-9A-Za-z]+$"
MAX_PAGE = 200


class MealCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: uuid.UUID
    meal_type: MealType
    eaten_at: datetime
    name: str = Field(min_length=1, max_length=120)
    calories: Decimal = Field(ge=0, le=5000)
    protein_g: Decimal = Field(ge=0, le=300)
    carbs_g: Decimal = Field(ge=0, le=500)
    fat_g: Decimal = Field(ge=0, le=300)
    photo_id: str | None = Field(default=None, pattern=PHOTO_ID_PATTERN)
    source: MealSource


class MealPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    meal_type: MealType | None = None
    eaten_at: datetime | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    calories: Decimal | None = Field(default=None, ge=0, le=5000)
    protein_g: Decimal | None = Field(default=None, ge=0, le=300)
    carbs_g: Decimal | None = Field(default=None, ge=0, le=500)
    fat_g: Decimal | None = Field(default=None, ge=0, le=300)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "MealPatch":
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        return self


def _meal_out(meal: Meal) -> dict[str, Any]:
    return {
        "id": meal.id,
        "client_id": str(meal.client_id),
        "meal_type": meal.meal_type,
        "eaten_at": meal.eaten_at.isoformat(),
        "name": meal.name,
        "calories": float(meal.calories),
        "protein_g": float(meal.protein_g),
        "carbs_g": float(meal.carbs_g),
        "fat_g": float(meal.fat_g),
        "photo_id": meal.photo_id,
        "source": meal.source,
        "version": meal.version,
        "created_at": meal.created_at.isoformat(),
    }


def _same_content(meal: Meal, body: MealCreate) -> bool:
    return (
        meal.meal_type == body.meal_type
        and meal.eaten_at == body.eaten_at
        and meal.name == body.name
        and meal.calories == body.calories
        and meal.protein_g == body.protein_g
        and meal.carbs_g == body.carbs_g
        and meal.fat_g == body.fat_g
    )


async def _owned(session: SessionDep, user_id: str, meal_id: str) -> Meal:
    result = await session.execute(select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id))
    meal = result.scalar_one_or_none()
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found.")
    return meal


def _day_bounds(start: date | None, end: date | None) -> tuple[datetime | None, datetime | None]:
    lower = datetime.combine(start, time.min, tzinfo=UTC) if start else None
    upper = datetime.combine(end + timedelta(days=1), time.min, tzinfo=UTC) if end else None
    return lower, upper


@router.get("/meals", operation_id="listMeals")
async def list_meals(
    user_id: CurrentUserId,
    session: SessionDep,
    day: Annotated[date | None, Query(alias="date")] = None,
    start: Annotated[date | None, Query(alias="from")] = None,
    end: Annotated[date | None, Query(alias="to")] = None,
    cursor: Annotated[str | None, Query(pattern=r"^[0-9]{1,9}$")] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE)] = 50,
) -> dict[str, Any]:
    lower, upper = _day_bounds(day or start, day or end)
    query = select(Meal).where(Meal.user_id == user_id)
    if lower is not None:
        query = query.where(Meal.eaten_at >= lower)
    if upper is not None:
        query = query.where(Meal.eaten_at < upper)
    offset = int(cursor) if cursor else 0
    rows = (
        (
            await session.execute(
                query.order_by(Meal.eaten_at.desc(), Meal.id).offset(offset).limit(limit + 1)
            )
        )
        .scalars()
        .all()
    )
    page = rows[:limit]
    next_cursor = str(offset + limit) if len(rows) > limit else None
    return {"items": [_meal_out(meal) for meal in page], "next_cursor": next_cursor}


@router.post("/meals", operation_id="createMeal", status_code=201)
async def create_meal(
    request: Request,
    response: Response,
    user_id: CurrentUserId,
    session: SessionDep,
    body: MealCreate,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
) -> dict[str, Any]:
    require_write(request, user_id)
    try:
        key = uuid.UUID(idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Idempotency-Key must be a UUID.") from exc
    if key != body.client_id:
        raise HTTPException(status_code=422, detail="Idempotency-Key must match client_id.")

    existing = (
        await session.execute(
            select(Meal).where(Meal.user_id == user_id, Meal.client_id == body.client_id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        if not _same_content(existing, body):
            raise HTTPException(status_code=409, detail="This key was used for a different meal.")
        response.status_code = 200
        return _meal_out(existing)

    cap = request.app.state.settings.meals_per_day
    created_today = (
        await session.execute(
            select(func.count())
            .select_from(Meal)
            .where(
                Meal.user_id == user_id, Meal.created_at >= datetime.now(UTC) - timedelta(days=1)
            )
        )
    ).scalar_one()
    if created_today >= cap:
        raise HTTPException(status_code=429, detail="Daily meal limit reached. Try again tomorrow.")

    meal = Meal(
        user_id=user_id,
        client_id=body.client_id,
        meal_type=body.meal_type,
        eaten_at=body.eaten_at,
        name=body.name,
        calories=body.calories,
        protein_g=body.protein_g,
        carbs_g=body.carbs_g,
        fat_g=body.fat_g,
        photo_id=body.photo_id,
        source=body.source,
    )
    session.add(meal)
    try:
        await session.commit()
    except IntegrityError as exc:
        # A concurrent request with the same key won the race. Treat this as a replay.
        await session.rollback()
        raise HTTPException(status_code=409, detail="Retry the request.") from exc
    await session.refresh(meal)
    response.headers["Location"] = f"/api/v1/meals/{meal.id}"
    return _meal_out(meal)


@router.get("/meals/{meal_id}", operation_id="getMeal")
async def get_meal(
    meal_id: Annotated[str, Path(pattern=r"^meal_[0-9A-Za-z]{1,60}$")],
    user_id: CurrentUserId,
    session: SessionDep,
) -> dict[str, Any]:
    return _meal_out(await _owned(session, user_id, meal_id))


@router.patch("/meals/{meal_id}", operation_id="updateMeal")
async def update_meal(
    meal_id: Annotated[str, Path(pattern=r"^meal_[0-9A-Za-z]{1,60}$")],
    request: Request,
    user_id: CurrentUserId,
    session: SessionDep,
    body: MealPatch,
    if_match: Annotated[str, Header(alias="If-Match")],
) -> dict[str, Any]:
    require_write(request, user_id)
    meal = await _owned(session, user_id, meal_id)
    expected = if_match.strip().strip('"')
    if not expected.isdigit() or int(expected) != meal.version:
        raise HTTPException(status_code=412, detail="The meal changed. Reload and try again.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(meal, field, value)
    meal.version += 1
    meal.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(meal)
    return _meal_out(meal)


@router.delete("/meals/{meal_id}", operation_id="deleteMeal", status_code=204)
async def delete_meal(
    meal_id: Annotated[str, Path(pattern=r"^meal_[0-9A-Za-z]{1,60}$")],
    request: Request,
    user_id: CurrentUserId,
    session: SessionDep,
) -> None:
    require_write(request, user_id)
    meal = await _owned(session, user_id, meal_id)
    await session.delete(meal)
    await session.commit()
