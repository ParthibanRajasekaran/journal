"""Native sign-in (spike). Each login is bound to the attempt that started it.

See DESIGN.md.

Order for completion:
1. Read the pending attempt named by the client's secret (read-only).
2. Verify the ID token with the existing Google verifier, against that attempt's nonce (read-only).
3. In ONE transaction: consume the attempt, upsert the user, apply the 18+ rule, start the session.
   COMMIT. Any failure, including inside step 3, ROLLBACK, so the attempt stays pending and no
   session exists.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app import native_attempts
from app.auth import google, service
from app.auth.deps import SessionDep, auth_key, require_csrf
from app.auth.tokens import AuthError, issue_access_token

router = APIRouter(tags=["Auth"])

SIGN_IN_REFUSED = "Sign-in could not be completed. Start again."


class AttemptOut(BaseModel):
    attempt_secret: str
    nonce: str
    expires_in: int


class AttemptRef(BaseModel):
    attempt_secret: Annotated[str, Field(min_length=20, max_length=128)]


class CompleteIn(BaseModel):
    attempt_secret: Annotated[str, Field(min_length=20, max_length=128)]
    id_token: Annotated[str, Field(min_length=20, max_length=8192)]
    adult: bool = False


class RefreshIn(BaseModel):
    refresh_token: Annotated[str, Field(min_length=20, max_length=256)]


class TokensOut(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int


class _Refused(Exception):
    pass


class _AdultRequired(Exception):
    pass


@router.post("/auth/native/attempts", operation_id="createNativeAttempt", status_code=201)
async def create_attempt(request: Request, session: SessionDep) -> AttemptOut:
    require_csrf(request)
    secret, nonce = native_attempts.new_attempt()
    await native_attempts.add_attempt(session, secret, nonce)
    await session.commit()
    return AttemptOut(
        attempt_secret=secret, nonce=nonce, expires_in=native_attempts.ATTEMPT_TTL_SECONDS
    )


@router.post("/auth/native/attempts/cancel", operation_id="cancelNativeAttempt", status_code=204)
async def cancel_attempt(request: Request, body: AttemptRef, session: SessionDep) -> Response:
    require_csrf(request)
    await native_attempts.cancel_attempt(session, body.attempt_secret)
    await session.commit()
    return Response(status_code=204)


@router.post("/auth/native/complete", operation_id="completeNativeSignIn")
async def complete_sign_in(request: Request, body: CompleteIn, session: SessionDep) -> TokensOut:
    require_csrf(request)
    settings = request.app.state.settings
    if settings.google_client_id is None:
        raise HTTPException(status_code=503, detail="Sign-in is not configured.")
    key = auth_key(settings)

    attempt = await native_attempts.pending_attempt(session, body.attempt_secret)
    if attempt is None:
        raise HTTPException(status_code=401, detail=SIGN_IN_REFUSED)
    try:
        claims = google.verify_id_token(
            body.id_token,
            client_id=settings.google_client_id,
            expected_nonce=attempt.nonce,
            keys=request.app.state.jwks,
        )
    except AuthError as exc:
        # Nothing has been written. The attempt stays pending, so the same login can still complete.
        raise HTTPException(status_code=401, detail=SIGN_IN_REFUSED) from exc
    email = claims.get("email")
    if not isinstance(email, str):
        raise HTTPException(status_code=401, detail=SIGN_IN_REFUSED)

    try:
        if not await native_attempts.consume_attempt(session, body.attempt_secret):
            raise _Refused()
        user = await service.upsert_user(
            session,
            google_sub=str(claims["sub"]),
            email=email,
            name=claims.get("name") if isinstance(claims.get("name"), str) else None,
        )
        if user.adult_confirmed_at is None:
            if not body.adult:
                raise _AdultRequired()
            user.adult_confirmed_at = datetime.now(UTC)
        user_id = user.id
        refresh = await service.start_session(
            session, user_id=user_id, ttl_days=settings.refresh_token_ttl_days
        )
        await session.commit()
    except _Refused:
        await session.rollback()
        raise HTTPException(status_code=401, detail=SIGN_IN_REFUSED) from None
    except _AdultRequired:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="Confirm you are 18 or older to create an account."
        ) from None
    except Exception:
        await session.rollback()
        raise

    access = issue_access_token(user_id, key, settings.access_token_ttl_seconds)
    return TokensOut(
        access_token=access, refresh_token=refresh, expires_in=settings.access_token_ttl_seconds
    )


@router.post("/auth/native/refresh", operation_id="refreshNativeSession")
async def refresh_session(request: Request, body: RefreshIn, session: SessionDep) -> TokensOut:
    require_csrf(request)
    settings = request.app.state.settings
    try:
        user_id, new_refresh = await service.rotate(
            session, body.refresh_token, ttl_days=settings.refresh_token_ttl_days
        )
    except AuthError as exc:
        raise HTTPException(status_code=401, detail="Sign in required.") from exc
    access = issue_access_token(user_id, auth_key(settings), settings.access_token_ttl_seconds)
    return TokensOut(
        access_token=access, refresh_token=new_refresh, expires_in=settings.access_token_ttl_seconds
    )


@router.post("/auth/native/logout", operation_id="logoutNative", status_code=204)
async def logout_native(request: Request, body: RefreshIn, session: SessionDep) -> Response:
    require_csrf(request)
    await service.revoke(session, body.refresh_token)
    return Response(status_code=204)
