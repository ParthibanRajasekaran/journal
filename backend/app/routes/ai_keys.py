"""Bring-your-own-key: users store their own provider key, encrypted. Keys are never returned."""

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Path, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.ai.providers import ProviderKeyChecker, ProviderUnavailable, format_problem
from app.auth.deps import CurrentUserId, SessionDep, require_write
from app.crypto import CryptoError, encrypt, load_key
from app.db.models import AiKey

router = APIRouter(tags=["AI keys"])

ProviderName = Literal["openai", "anthropic", "gemini"]


class AiKeySave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    api_key: str = Field(min_length=20, max_length=300)
    # The user confirms they understand that requests go to their own provider, under its terms.
    acknowledge_provider_terms: Literal[True]


def _status(row: AiKey) -> dict[str, Any]:
    return {
        "provider": row.provider,
        "last4": row.last4,
        "validated_at": row.validated_at.isoformat(),
    }


def _encryption_key(request: Request) -> bytes:
    try:
        return load_key(request.app.state.settings.key_encryption_key)
    except CryptoError as exc:
        raise HTTPException(status_code=503, detail="Provider keys are not configured.") from exc


@router.get("/me/ai-keys", operation_id="listAiKeys")
async def list_ai_keys(user_id: CurrentUserId, session: SessionDep) -> list[dict[str, Any]]:
    rows = (
        (
            await session.execute(
                select(AiKey).where(AiKey.user_id == user_id).order_by(AiKey.provider)
            )
        )
        .scalars()
        .all()
    )
    return [_status(row) for row in rows]


@router.put("/me/ai-keys/{provider}", operation_id="saveAiKey")
async def save_ai_key(
    provider: Annotated[ProviderName, Path()],
    request: Request,
    user_id: CurrentUserId,
    session: SessionDep,
    body: AiKeySave,
) -> dict[str, Any]:
    require_write(request, user_id)
    problem = format_problem(provider, body.api_key)
    if problem is not None:
        raise HTTPException(status_code=422, detail=problem)

    key = _encryption_key(request)
    checker: ProviderKeyChecker = request.app.state.key_checker
    try:
        valid = await checker.is_valid(provider, body.api_key)
    except ProviderUnavailable as exc:
        raise HTTPException(
            status_code=503, detail="The provider could not be reached. Try again."
        ) from exc
    if not valid:
        raise HTTPException(status_code=422, detail="The provider rejected this key.")

    now = datetime.now(UTC)
    blob = encrypt(key, body.api_key, user_id, provider)
    statement = insert(AiKey).values(
        user_id=user_id,
        provider=provider,
        ciphertext=blob,
        last4=body.api_key[-4:],
        validated_at=now,
        updated_at=now,
    )
    statement = statement.on_conflict_do_update(
        constraint="user_provider",
        set_={
            "ciphertext": blob,
            "last4": body.api_key[-4:],
            "validated_at": now,
            "updated_at": now,
        },
    )
    await session.execute(statement)
    await session.commit()
    return {"provider": provider, "last4": body.api_key[-4:], "validated_at": now.isoformat()}


@router.delete("/me/ai-keys/{provider}", operation_id="deleteAiKey", status_code=204)
async def delete_ai_key(
    provider: Annotated[ProviderName, Path()],
    request: Request,
    user_id: CurrentUserId,
    session: SessionDep,
) -> Response:
    require_write(request, user_id)
    result = await session.execute(
        delete(AiKey).where(AiKey.user_id == user_id, AiKey.provider == provider)
    )
    await session.commit()
    if result.rowcount == 0:  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail="No key is saved for this provider.")
    return Response(status_code=204)
