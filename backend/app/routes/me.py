"""The signed-in user's profile: read, edit targets, and delete the account."""

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select

from app.auth.deps import CurrentUserId, SessionDep, require_csrf
from app.db.models import User

router = APIRouter(tags=["Me"])


class DailyTargetsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calories: Annotated[int | None, Field(ge=800, le=6000)] = None
    protein_g: Annotated[float | None, Field(ge=0, le=400)] = None


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: Annotated[str | None, Field(max_length=80)] = None
    daily_targets: DailyTargetsPatch | None = None


def _profile(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "daily_targets": {
            "calories": user.target_calories,
            "protein_g": float(user.target_protein_g)
            if user.target_protein_g is not None
            else None,
        },
    }


async def _current(session: SessionDep, user_id: str) -> User:
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return user


@router.get("/me", operation_id="getMe")
async def get_me(user_id: CurrentUserId, session: SessionDep) -> dict[str, Any]:
    return _profile(await _current(session, user_id))


@router.patch("/me", operation_id="updateMe")
async def update_me(
    request: Request, user_id: CurrentUserId, session: SessionDep, body: ProfilePatch
) -> dict[str, Any]:
    require_csrf(request)
    user = await _current(session, user_id)
    if "display_name" in body.model_fields_set:
        user.display_name = body.display_name
    if body.daily_targets is not None:
        targets = body.daily_targets.model_dump(exclude_unset=True)
        if "calories" in targets:
            user.target_calories = targets["calories"]
        if "protein_g" in targets:
            user.target_protein_g = targets["protein_g"]
    await session.commit()
    await session.refresh(user)
    return _profile(user)


@router.delete("/me", operation_id="deleteAccount", status_code=204)
async def delete_account(request: Request, user_id: CurrentUserId, session: SessionDep) -> Response:
    """Removes the user. Meals and refresh tokens go with them (ON DELETE CASCADE)."""
    require_csrf(request)
    await session.execute(delete(User).where(User.id == user_id))
    await session.commit()
    response = Response(status_code=204)
    response.delete_cookie("journal_access", path="/")
    response.delete_cookie("journal_refresh", path="/api/v1/auth")
    return response
