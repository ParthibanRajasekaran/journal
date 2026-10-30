"""Liveness and readiness. Liveness is public and touches nothing. Readiness checks the database."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.auth.deps import SessionDep

router = APIRouter(tags=["Health"])


@router.get("/health", operation_id="getHealth", summary="Liveness")
async def get_health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready", operation_id="getReadiness", summary="Readiness: database answers")
async def get_readiness(session: SessionDep) -> dict[str, str]:
    try:
        await session.execute(text("SELECT 1 FROM users LIMIT 1"))
    except Exception as exc:  # any failure means the service cannot serve real requests
        raise HTTPException(status_code=503, detail="Database is not ready.") from exc
    return {"status": "ready"}
