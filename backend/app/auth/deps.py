"""Request-level helpers: database sessions, current user, and the CSRF header check."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import AuthError, signing_key, user_id_from_access_token
from app.db.models import User


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


def _bearer_token(request: Request) -> str | None:
    """Native clients send the access token as a bearer token. Web keeps the HttpOnly cookie."""
    scheme, _, value = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        return None
    return value.strip()


async def _account_is_live(session: AsyncSession, user_id: str) -> bool:
    """True when the account exists and is not deleted. Deleted means deleted_at is set."""
    found = (
        await session.execute(select(User.id).where(User.id == user_id, User.deleted_at.is_(None)))
    ).scalar_one_or_none()
    return found is not None


async def current_user_id(
    request: Request, session: Annotated[AsyncSession, Depends(get_session)]
) -> str:
    # The browser cookie and a native bearer token are tried in turn. A candidate is used only when
    # its token verifies and its account is live. A stale, invalid or deleted-account cookie never
    # blocks a valid bearer token. A missing or unusable token reads no signing key.
    for token in (request.cookies.get(ACCESS_COOKIE), _bearer_token(request)):
        if not token:
            continue
        key = auth_key(request.app.state.settings)
        try:
            user_id = user_id_from_access_token(token, key)
        except AuthError:
            continue
        if await _account_is_live(session, user_id):
            return user_id
    raise HTTPException(status_code=401, detail="Sign in required.")


SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserId = Annotated[str, Depends(current_user_id)]
