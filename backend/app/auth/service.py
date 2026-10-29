"""Database work for sign-in: users and refresh-token families."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import AuthError, hash_opaque_token, new_opaque_token
from app.db.models import RefreshToken, User


async def upsert_user(
    session: AsyncSession, *, google_sub: str, email: str, name: str | None
) -> User:
    result = await session.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(google_sub=google_sub, email=email, display_name=name)
        session.add(user)
    else:
        user.email = email
        user.display_name = name
    await session.flush()
    return user


def _add_refresh(session: AsyncSession, *, user_id: str, family_id: str, ttl_days: int) -> str:
    raw = new_opaque_token()
    now = datetime.now(UTC)
    session.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id,
            token_hash=hash_opaque_token(raw),
            expires_at=now + timedelta(days=ttl_days),
        )
    )
    return raw


async def start_session(session: AsyncSession, *, user_id: str, ttl_days: int) -> str:
    """Begin a new refresh-token family for a sign-in. Caller commits."""
    return _add_refresh(session, user_id=user_id, family_id=uuid.uuid4().hex, ttl_days=ttl_days)


async def rotate(session: AsyncSession, raw: str, *, ttl_days: int) -> tuple[str, str]:
    """Exchange a refresh token for a new one. Reuse of a rotated token revokes the family."""
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_opaque_token(raw))
    )
    row = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise AuthError("refresh token invalid")
    if row.used_at is not None:
        # A rotated token came back: treat the whole family as stolen (ADR-004).
        await _revoke_family(session, row.family_id, now)
        await session.commit()
        raise AuthError("refresh token reused")

    row.used_at = now
    new_raw = _add_refresh(session, user_id=row.user_id, family_id=row.family_id, ttl_days=ttl_days)
    await session.commit()
    return row.user_id, new_raw


async def revoke(session: AsyncSession, raw: str) -> None:
    """Log out: revoke the family of this refresh token. Unknown tokens are ignored."""
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_opaque_token(raw))
    )
    row = result.scalar_one_or_none()
    if row is not None:
        await _revoke_family(session, row.family_id, datetime.now(UTC))
    await session.commit()


async def _revoke_family(session: AsyncSession, family_id: str, when: datetime) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=when)
    )
