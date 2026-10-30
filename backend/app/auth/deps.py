"""Request-level helpers: database sessions, current user, and the CSRF header check."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import AuthError, signing_key, user_id_from_access_token


def auth_key(settings: object) -> str:
    """The signing key, or 503 when sign-in is not configured (never a bare 500)."""
    try:
        return signing_key(settings.jwt_secret)  # type: ignore[attr-defined]
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Sign-in is not configured.") from exc


ACCESS_COOKIE = "journal_access"
REFRESH_COOKIE = "journal_refresh"
STATE_COOKIE = "journal_oauth"
REFRESH_PATH = "/api/v1/auth"
STATE_PATH = "/api/v1/auth/google"
CSRF_HEADER = "X-Journal-Request"


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        yield session


def require_csrf(request: Request) -> None:
    """Cross-site forms cannot set custom headers, and we send no CORS grant (ADR-004)."""
    if request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(status_code=403, detail="Missing request header.")


def require_write(request: Request, user_id: str) -> None:
    """Every state-changing request: CSRF header first, then the per-user write limit."""
    require_csrf(request)
    if not request.app.state.write_limiter.allow(user_id):
        raise HTTPException(status_code=429, detail="Too many changes. Try again in a minute.")


def current_user_id(request: Request) -> str:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required.")
    try:
        return user_id_from_access_token(token, auth_key(request.app.state.settings))
    except AuthError as exc:
        raise HTTPException(status_code=401, detail="Sign in required.") from exc


SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserId = Annotated[str, Depends(current_user_id)]
