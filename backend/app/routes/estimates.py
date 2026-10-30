"""Text estimates. Nothing is saved: the user reviews the numbers and saves a meal themselves."""

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.ai.estimate import EstimateInvalid, ask_provider, parse_reply
from app.ai.providers import PROVIDERS, Provider, ProviderUnavailable
from app.auth.deps import CurrentUserId, SessionDep, require_write
from app.config import Settings
from app.crypto import CryptoError, decrypt, load_key
from app.db.models import AiKey

router = APIRouter(tags=["Estimates"])


class EstimateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=3, max_length=1000)
    provider: Literal["openai", "anthropic", "gemini"] | None = None


def _model_for(request: Request, provider: Provider) -> str:
    settings: Settings = request.app.state.settings
    return {
        "openai": settings.estimate_model_openai,
        "anthropic": settings.estimate_model_anthropic,
        "gemini": settings.estimate_model_gemini,
    }[provider]


@router.post("/estimates", operation_id="createEstimate")
async def create_estimate(
    request: Request, user_id: CurrentUserId, session: SessionDep, body: EstimateRequest
) -> dict[str, Any]:
    require_write(request, user_id)
    rows = (await session.execute(select(AiKey).where(AiKey.user_id == user_id))).scalars().all()
    saved = {row.provider: row for row in rows}
    order: list[Provider] = [body.provider] if body.provider else list(PROVIDERS)
    provider = next((p for p in order if p in saved), None)
    if provider is None:
        raise HTTPException(
            status_code=409, detail="Add your AI key in Settings to estimate meals."
        )

    try:
        key = load_key(request.app.state.settings.key_encryption_key)
        api_key = decrypt(key, saved[provider].ciphertext, user_id, provider)
    except CryptoError as exc:
        raise HTTPException(
            status_code=503, detail="Estimates are not available right now."
        ) from exc

    try:
        reply = await ask_provider(
            request.app.state.estimate_http,
            provider,
            _model_for(request, provider),
            api_key,
            body.text,
        )
        estimate = parse_reply(reply)
    except ProviderUnavailable as exc:
        raise HTTPException(
            status_code=503, detail="The provider could not be reached. Try again."
        ) from exc
    except EstimateInvalid as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "provider": provider,
        "estimate": {
            "name": estimate.name,
            "calories": round(estimate.calories, 1),
            "protein_g": round(estimate.protein_g, 1),
            "carbs_g": round(estimate.carbs_g, 1),
            "fat_g": round(estimate.fat_g, 1),
            "confidence": round(estimate.confidence, 2),
        },
    }
