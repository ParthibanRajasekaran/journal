"""Sign-in routes. The backend holds the client secret. Tokens travel only in HttpOnly cookies."""

import secrets

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from app.auth import google, service
from app.auth.deps import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    REFRESH_PATH,
    STATE_COOKIE,
    STATE_PATH,
    SessionDep,
    auth_key,
    current_user_id,
    require_csrf,
)
from app.auth.tokens import (
    AuthError,
    issue_access_token,
    issue_state_token,
    pkce_challenge,
    read_state_token,
)

router = APIRouter(tags=["Auth"])


def _redirect_uri(request: Request) -> str:
    return f"{request.app.state.settings.public_base_url}/api/v1/auth/google/callback"


def _set_session_cookies(response: Response, request: Request, access: str, refresh: str) -> None:
    settings = request.app.state.settings
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.access_token_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.refresh_token_ttl_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=REFRESH_PATH,
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)


@router.get("/auth/google/start", operation_id="startGoogleSignIn")
async def start_google_sign_in(request: Request) -> RedirectResponse:
    settings = request.app.state.settings
    if settings.google_client_id is None:
        raise HTTPException(status_code=503, detail="Sign-in is not configured.")
    key = auth_key(settings)

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    url = google.authorization_url(
        settings.google_client_id,
        _redirect_uri(request),
        state,
        nonce,
        pkce_challenge(verifier),
    )
    response = RedirectResponse(url, status_code=302)
    response.set_cookie(
        STATE_COOKIE,
        issue_state_token(state, nonce, verifier, key, settings.oauth_state_ttl_seconds),
        max_age=settings.oauth_state_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",  # must survive the top-level redirect back from Google
        path=STATE_PATH,
    )
    return response


@router.get(
    "/auth/google/callback",
    operation_id="googleCallback",
    response_class=RedirectResponse,
    status_code=303,
)
async def google_callback(
    request: Request,
    session: SessionDep,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    settings = request.app.state.settings
    if error is not None or code is None or state is None:
        raise HTTPException(status_code=400, detail="Sign-in was not completed.")
    key = auth_key(settings)
    if settings.google_client_id is None or settings.google_client_secret is None:
        raise HTTPException(status_code=503, detail="Sign-in is not configured.")

    cookie = request.cookies.get(STATE_COOKIE)
    if cookie is None:
        raise HTTPException(status_code=400, detail="Sign-in expired. Please try again.")
    try:
        expected = read_state_token(cookie, key)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail="Sign-in expired. Please try again.") from exc
    if not secrets.compare_digest(expected["state"], state):
        raise HTTPException(status_code=400, detail="Sign-in could not be verified.")

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            id_token = await google.exchange_code(
                http,
                code=code,
                verifier=expected["verifier"],
                redirect_uri=_redirect_uri(request),
                client_id=settings.google_client_id,
                client_secret=settings.google_client_secret.get_secret_value(),
            )
        claims = google.verify_id_token(
            id_token,
            client_id=settings.google_client_id,
            expected_nonce=expected["nonce"],
            keys=request.app.state.jwks,
        )
    except (AuthError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=401, detail="Sign-in could not be verified.") from exc

    email = claims.get("email")
    if not isinstance(email, str):
        raise HTTPException(status_code=400, detail="Sign-in needs an email address.")
    user = await service.upsert_user(
        session,
        google_sub=str(claims["sub"]),
        email=email,
        name=claims.get("name") if isinstance(claims.get("name"), str) else None,
    )
    refresh = await service.start_session(
        session, user_id=user.id, ttl_days=settings.refresh_token_ttl_days
    )
    await session.commit()

    access = issue_access_token(user.id, key, settings.access_token_ttl_seconds)
    response = RedirectResponse("/api/v1/me", status_code=303)
    _set_session_cookies(response, request, access, refresh)
    response.delete_cookie(STATE_COOKIE, path=STATE_PATH)
    return response


@router.post("/auth/refresh", operation_id="refreshSession", status_code=204)
async def refresh_session(
    request: Request,
    response: Response,
    session: SessionDep,
) -> None:
    require_csrf(request)
    settings = request.app.state.settings
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw is None:
        raise HTTPException(status_code=401, detail="Sign in required.")
    try:
        user_id, new_refresh = await service.rotate(
            session, raw, ttl_days=settings.refresh_token_ttl_days
        )
    except AuthError as exc:
        _clear_session_cookies(response)
        raise HTTPException(status_code=401, detail="Sign in required.") from exc
    access = issue_access_token(user_id, auth_key(settings), settings.access_token_ttl_seconds)
    _set_session_cookies(response, request, access, new_refresh)


@router.post("/auth/logout", operation_id="logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    session: SessionDep,
) -> None:
    require_csrf(request)
    current_user_id(request)
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw is not None:
        await service.revoke(session, raw)
    _clear_session_cookies(response)
