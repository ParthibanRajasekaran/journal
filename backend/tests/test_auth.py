"""Sign-in behaviour: state and nonce checks, token verification, cookies, rotation, CSRF."""

import base64
import hashlib
import time
from collections.abc import Iterator
from typing import Any
from urllib.parse import parse_qs, urlparse

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.auth import google
from app.auth.tokens import signing_key
from app.config import Settings
from app.db.models import RefreshToken
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all

CLIENT_ID = "test-client.apps.googleusercontent.com"
CSRF = {"X-Journal-Request": "1"}

_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_pem = _private.public_key()
_other_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeKeys:
    def get_signing_key_from_jwt(self, token: str) -> Any:
        class _Key:
            key = _public_pem

        return _Key()


def make_id_token(**overrides: Any) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "google-subject-1",
        "email": "person@example.com",
        "email_verified": True,
        "name": "Test Person",
        "nonce": "NONCE",
        "iat": now,
        "exp": now + 300,
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, _private, algorithm="RS256", headers={"kid": "test"})


@pytest.fixture(autouse=True)
def _schema_and_clean_db() -> None:
    migrate_to_head()
    run(truncate_all)


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    application = create_app(settings)
    application.state.jwks = FakeKeys()
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, follow_redirects=False) as test_client:
        yield test_client


def _start(client: TestClient) -> tuple[str, str]:
    """Run the start step and return (state, nonce) as Google would see them."""
    response = client.get("/api/v1/auth/google/start")
    assert response.status_code == 302
    query = parse_qs(urlparse(response.headers["location"]).query)
    return query["state"][0], query["nonce"][0]


def _callback(
    client: TestClient,
    state: str,
    monkeypatch: pytest.MonkeyPatch,
    nonce: str | None = None,
    id_token: str | None = None,
) -> Any:
    async def fake_exchange(*_: Any, **__: Any) -> str:
        return id_token or make_id_token(nonce=nonce or "NONCE")

    monkeypatch.setattr(google, "exchange_code", fake_exchange)
    return client.get("/api/v1/auth/google/callback", params={"code": "auth-code", "state": state})


def _sign_in(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    state, nonce = _start(client)
    response = _callback(client, state, monkeypatch, nonce=nonce)
    assert response.status_code == 303, response.text


# --- start -----------------------------------------------------------------------------


def test_start_sends_pkce_state_nonce_and_secure_cookie_flags(client: TestClient) -> None:
    response = client.get("/api/v1/auth/google/start")
    query = parse_qs(urlparse(response.headers["location"]).query)
    assert query["code_challenge_method"] == ["S256"]
    assert "openid" in query["scope"][0]
    assert query["client_id"] == [CLIENT_ID]
    cookie = response.headers["set-cookie"].lower()
    assert "journal_oauth=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie


def test_start_is_refused_when_sign_in_is_not_configured(settings: Settings) -> None:
    unconfigured = Settings(environment="test", database_url=settings.database_url)
    with TestClient(create_app(unconfigured), follow_redirects=False) as client:
        response = client.get("/api/v1/auth/google/start")
    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")


def test_pkce_challenge_matches_the_verifier(client: TestClient, settings: Settings) -> None:
    response = client.get("/api/v1/auth/google/start")
    query = parse_qs(urlparse(response.headers["location"]).query)
    state_cookie = client.cookies.get("journal_oauth")
    assert state_cookie is not None
    # The verifier is only inside the signed state cookie; check the challenge is S256 of it.
    from app.auth.tokens import read_state_token

    verifier = read_state_token(state_cookie, signing_key(settings.jwt_secret))["verifier"]
    digest = hashlib.sha256(verifier.encode()).digest()
    assert query["code_challenge"] == [base64.urlsafe_b64encode(digest).rstrip(b"=").decode()]


# --- callback --------------------------------------------------------------------------


def test_callback_without_state_cookie_is_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    response = _callback(client, "anything", monkeypatch)
    assert response.status_code == 400


def test_callback_with_mismatched_state_is_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _start(client)
    response = _callback(client, "forged-state", monkeypatch)
    assert response.status_code == 400


def test_callback_with_error_from_google_is_refused(client: TestClient) -> None:
    response = client.get("/api/v1/auth/google/callback", params={"error": "access_denied"})
    assert response.status_code == 400


def test_successful_sign_in_sets_http_only_cookies_and_creates_the_user(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    state, nonce = _start(client)
    response = _callback(client, state, monkeypatch, nonce=nonce)
    assert response.status_code == 303
    assert response.headers["location"] == "/api/v1/me"
    set_cookie = " ".join(response.headers.get_list("set-cookie")).lower()
    assert "journal_access=" in set_cookie
    assert "journal_refresh=" in set_cookie
    assert set_cookie.count("httponly") >= 2
    assert "samesite=strict" in set_cookie
    assert "path=/api/v1/auth" in set_cookie

    profile = client.get("/api/v1/me")
    assert profile.status_code == 200
    assert profile.json()["email"] == "person@example.com"


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "someone-else.apps.googleusercontent.com"},
        {"iss": "https://evil.example"},
        {"email_verified": False},
        {"exp": int(time.time()) - 3600},
        {"nonce": "a-different-nonce"},
    ],
)
def test_forged_or_mismatched_id_tokens_are_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, overrides: dict[str, Any]
) -> None:
    state, nonce = _start(client)
    response = _callback(
        client, state, monkeypatch, nonce=nonce, id_token=make_id_token(**overrides)
    )
    assert response.status_code == 401


def test_id_token_signed_by_another_key_is_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    state, nonce = _start(client)
    forged = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": CLIENT_ID,
            "sub": "x",
            "nonce": nonce,
            "email": "a@b.c",
            "email_verified": True,
            "iat": int(time.time()),
            "exp": int(time.time()) + 300,
        },
        _other_private,
        algorithm="RS256",
        headers={"kid": "test"},
    )
    response = _callback(client, state, monkeypatch, nonce=nonce, id_token=forged)
    assert response.status_code == 401


def test_same_google_account_signing_in_again_reuses_the_user(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch)
    first = client.get("/api/v1/me").json()["id"]
    client.cookies.clear()
    _sign_in(client, monkeypatch)
    assert client.get("/api/v1/me").json()["id"] == first


# --- access tokens and /me -------------------------------------------------------------


def test_me_rejects_a_token_signed_with_the_wrong_key(client: TestClient) -> None:
    forged = jwt.encode(
        {
            "iss": "journal-api",
            "sub": "someone",
            "typ": "access",
            "iat": int(time.time()),
            "exp": int(time.time()) + 300,
        },
        "wrong-key-that-is-definitely-not-ours-0123456789",
        algorithm="HS256",
    )
    client.cookies.set("journal_access", forged)
    assert client.get("/api/v1/me").status_code == 401


def test_me_rejects_an_unsigned_token(client: TestClient) -> None:
    unsigned = jwt.encode(
        {"iss": "journal-api", "sub": "someone", "typ": "access", "exp": int(time.time()) + 300},
        key="",
        algorithm="none",
    )
    client.cookies.set("journal_access", unsigned)
    assert client.get("/api/v1/me").status_code == 401


def test_me_requires_a_session(client: TestClient) -> None:
    assert client.get("/api/v1/me").status_code == 401


# --- refresh rotation and CSRF ---------------------------------------------------------


def test_refresh_needs_the_csrf_header(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in(client, monkeypatch)
    assert client.post("/api/v1/auth/refresh").status_code == 403


def test_refresh_rotates_and_reuse_revokes_the_family(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch)
    old_refresh = client.cookies.get("journal_refresh")
    assert old_refresh is not None

    assert client.post("/api/v1/auth/refresh", headers=CSRF).status_code == 204
    new_refresh = client.cookies.get("journal_refresh")
    assert new_refresh
    assert new_refresh != old_refresh

    # Presenting the rotated (old) token again must fail and revoke the family.
    client.cookies.set("journal_refresh", old_refresh, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh", headers=CSRF).status_code == 401

    # The newest token is in the same family, so it is now revoked too.
    client.cookies.set("journal_refresh", new_refresh, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh", headers=CSRF).status_code == 401


def test_only_hashes_of_refresh_tokens_are_stored(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch)
    raw = client.cookies.get("journal_refresh")

    async def stored(engine: AsyncEngine) -> list[str]:
        async with engine.connect() as conn:
            rows = await conn.execute(select(RefreshToken.token_hash))
            return [row[0] for row in rows.all()]

    hashes = run(stored)
    assert raw not in hashes
    assert hashlib.sha256(raw.encode()).hexdigest() in hashes


def test_logout_needs_csrf_and_a_session_then_revokes(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch)
    raw = client.cookies.get("journal_refresh")
    assert client.post("/api/v1/auth/logout").status_code == 403
    assert client.post("/api/v1/auth/logout", headers=CSRF).status_code == 204
    assert client.get("/api/v1/me").status_code == 401

    client.cookies.set("journal_refresh", raw, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh", headers=CSRF).status_code == 401


def test_tables_are_empty_after_truncate(settings: Settings) -> None:
    async def count(engine: AsyncEngine) -> int:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT count(*) FROM refresh_tokens"))
            return int(result.scalar_one())

    assert run(count) == 0
