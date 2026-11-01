"""Attempt-bound native sign-in: the database steps.

See docs/factory/proposals/native-auth/DESIGN.md.

Only functions that touch the attempt table live here. Token verification is done by the route
with the existing Google verifier, before any row is changed.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import NativeAttempt

ATTEMPT_TTL_SECONDS = 300


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def now() -> datetime:
    return datetime.now(UTC)


def new_attempt() -> tuple[str, str]:
    """Returns (attempt_secret, nonce). The caller stores digest(secret) and the nonce."""
    return secrets.token_urlsafe(32), secrets.token_urlsafe(32)


async def add_attempt(session: AsyncSession, secret: str, nonce: str) -> None:
    session.add(
        NativeAttempt(
            attempt_hash=digest(secret),
            nonce=nonce,
            state="pending",
            expires_at=now() + timedelta(seconds=ATTEMPT_TTL_SECONDS),
        )
    )


async def pending_attempt(session: AsyncSession, secret: str) -> NativeAttempt | None:
    """The attempt, if it is pending and not expired. Read-only."""
    row = (
        await session.execute(
            select(NativeAttempt).where(
                NativeAttempt.attempt_hash == digest(secret),
                NativeAttempt.state == "pending",
                NativeAttempt.expires_at > now(),
            )
        )
    ).scalar_one_or_none()
    return row


async def consume_attempt(session: AsyncSession, secret: str) -> bool:
    """Atomically move one pending, unexpired attempt to consumed. True for exactly one caller.

    This statement is the single point of consumption. It runs inside the caller's transaction,
    so a rollback of that transaction also returns the attempt to pending.
    """
    result = cast(
        CursorResult[Any],
        await session.execute(
            update(NativeAttempt)
            .where(
                NativeAttempt.attempt_hash == digest(secret),
                NativeAttempt.state == "pending",
                NativeAttempt.expires_at > now(),
            )
            .values(state="consumed")
        ),
    )
    return result.rowcount == 1


async def cancel_attempt(session: AsyncSession, secret: str) -> None:
    await session.execute(
        update(NativeAttempt)
        .where(NativeAttempt.attempt_hash == digest(secret), NativeAttempt.state == "pending")
        .values(state="cancelled")
    )
