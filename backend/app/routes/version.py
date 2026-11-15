"""Build provenance: which source and which migration this API is running. Public, reads no data."""

from functools import lru_cache
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter, Request
from pydantic import BaseModel

API_VERSION = "1.0.0-draft"
ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"

router = APIRouter(tags=["Health"])


class VersionOut(BaseModel):
    api_version: str
    source_sha: str
    migration_head: str | None
    environment: str


@lru_cache
def migration_head() -> str | None:
    """Newest revision shipped in this image, read from the migration scripts (no database)."""
    return ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()


@router.get("/version", operation_id="getVersion", summary="Build provenance")
async def get_version(request: Request) -> VersionOut:
    settings = request.app.state.settings
    return VersionOut(
        api_version=API_VERSION,
        source_sha=settings.source_sha,
        migration_head=migration_head(),
        environment=settings.environment,
    )
