"""The signed-in user's profile."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.auth.deps import CurrentUserId, SessionDep
from app.db.models import User

router = APIRouter(tags=["Me"])


@router.get("/me", operation_id="getMe")
async def get_me(user_id: CurrentUserId, session: SessionDep) -> dict[str, object]:
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=401, detail="Sign in required.")
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
