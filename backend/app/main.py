"""Application factory. Routes are mounted under /api/v1 (ADR-001 versioning)."""

import httpx
from fastapi import APIRouter, FastAPI
from jwt import PyJWKClient

from app.ai.providers import ProviderKeyChecker
from app.auth.google import JWKS_URL
from app.config import Settings, get_settings
from app.db.session import make_engine, make_session_factory
from app.errors import install_problem_handlers
from app.limits import WriteLimiter
from app.routes import ai_keys, auth, days, estimates, health, me, meals

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    production = settings.environment == "production"
    app = FastAPI(
        title="Journal API",
        version="1.0.0-draft",
        docs_url=None if production else "/api/docs",
        openapi_url=None if production else "/api/openapi.json",
        redoc_url=None,
    )
    app.state.settings = settings
    engine = make_engine(settings)
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    app.state.jwks = PyJWKClient(JWKS_URL, cache_keys=True)
    app.state.write_limiter = WriteLimiter(settings.write_requests_per_minute)
    app.state.key_checker = ProviderKeyChecker(httpx.AsyncClient())
    app.state.estimate_http = httpx.AsyncClient()
    install_problem_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    api.include_router(health.router)
    api.include_router(auth.router)
    api.include_router(me.router)
    api.include_router(meals.router)
    api.include_router(days.router)
    api.include_router(ai_keys.router)
    api.include_router(estimates.router)
    app.include_router(api)
    return app


app = create_app()
