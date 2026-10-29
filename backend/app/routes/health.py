"""Liveness endpoint. Public by design (docs/openapi.yaml, operation getHealth)."""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health", operation_id="getHealth", summary="Liveness")
async def get_health() -> dict[str, str]:
    return {"status": "ok"}
