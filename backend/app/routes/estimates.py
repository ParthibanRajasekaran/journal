"""Text estimates. Nothing is saved: the user reviews the numbers and saves a meal themselves.

Two steps at most. First the description goes to the provider. If the answer depends on a
detail we do not have, the response lists questions. The client sends the same description back
with the user's answers, and that second answer is final.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.ai.estimate import (
    Estimate,
    EstimateInvalid,
    Pending,
    SuppliedAnswer,
    ask_provider,
    describe_answers,
    parse_reply,
)
from app.ai.providers import PROVIDERS, Provider, ProviderUnavailable
from app.auth.deps import CurrentUserId, SessionDep, require_write
from app.config import Settings
from app.crypto import CryptoError, decrypt, load_key
from app.db.models import AiKey
from app.telemetry import estimate_outcome

router = APIRouter(tags=["Estimates"])


class EstimateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=3, max_length=1000)
    provider: Literal["openai", "anthropic", "gemini"] | None = None
    answers: Annotated[list[SuppliedAnswer], Field(max_length=2)] | None = None


def _model_for(settings: Settings, provider: Provider) -> str:
    return {
        "openai": settings.estimate_model_openai,
        "anthropic": settings.estimate_model_anthropic,
        "gemini": settings.estimate_model_gemini,
    }[provider]


def _estimate_out(estimate: Estimate) -> dict[str, Any]:
    return {
        "name": estimate.name,
        "calories": round(estimate.calories, 1),
        "protein_g": round(estimate.protein_g, 1),
        "carbs_g": round(estimate.carbs_g, 1),
        "fat_g": round(estimate.fat_g, 1),
        "confidence": round(estimate.confidence, 2),
        "items": [
            {
                "name": i.name,
                "calories": round(i.calories, 1),
                "protein_g": round(i.protein_g, 1),
                "carbs_g": round(i.carbs_g, 1),
                "fat_g": round(i.fat_g, 1),
            }
            for i in estimate.items
        ],
        "assumptions": estimate.assumptions,
    }


@router.post("/estimates", operation_id="createEstimate")
async def create_estimate(
    request: Request, user_id: CurrentUserId, session: SessionDep, body: EstimateRequest
) -> dict[str, Any]:
    require_write(request, user_id)
    settings: Settings = request.app.state.settings
    rows = (await session.execute(select(AiKey).where(AiKey.user_id == user_id))).scalars().all()
    saved = {row.provider: row for row in rows}
    order: list[Provider] = [body.provider] if body.provider else list(PROVIDERS)
    provider = next((p for p in order if p in saved), None)
    if provider is None:
        estimate_outcome("refused", "none")
        raise HTTPException(
            status_code=409, detail="Add your AI key in Settings to estimate meals."
        )

    try:
        key = load_key(settings.key_encryption_key)
        api_key = decrypt(key, saved[provider].ciphertext, user_id, provider)
    except CryptoError as exc:
        raise HTTPException(
            status_code=503, detail="Estimates are not available right now."
        ) from exc

    description = body.text
    if body.answers:
        description += "\n\nDetails from the user:\n" + describe_answers(body.answers)

    try:
        reply = await ask_provider(
            request.app.state.estimate_http,
            provider,
            _model_for(settings, provider),
            api_key,
            description,
        )
        result = parse_reply(reply, supplied=body.answers)
    except ProviderUnavailable as exc:
        estimate_outcome("error", provider)
        raise HTTPException(
            status_code=503, detail="The provider could not be reached. Try again."
        ) from exc
    except EstimateInvalid as exc:
        estimate_outcome("invalid", provider)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if isinstance(result, Pending):
        estimate_outcome("questions", provider)
        return {
            "status": "needs_answers",
            "provider": provider,
            "questions": [q.model_dump() for q in result.questions],
        }
    estimate_outcome("ok", provider)
    return {"status": "estimate", "provider": provider, "estimate": _estimate_out(result)}
