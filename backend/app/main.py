"""Application factory. Routes are mounted under /api/v1 (ADR-001 versioning)."""

from fastapi import APIRouter, FastAPI

from app.config import Settings, get_settings
from app.errors import install_problem_handlers
from app.routes import health

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="Journal API",
        version="1.0.0-draft",
        docs_url="/api/docs" if settings.environment != "production" else None,
        openapi_url="/api/openapi.json" if settings.environment != "production" else None,
        redoc_url=None,
    )
    app.state.settings = settings
    install_problem_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    api.include_router(health.router)
    app.include_router(api)
    return app


app = create_app()
