"""A deleted account's session is refused cleanly, and nothing it sends is persisted or replayed.

The cookie-based session is removed on deletion, but a copy of the access cookie taken before
deletion remains a valid token for the deleted user id until it expires. Such a token must be
refused as unauthenticated (401). It must not reach the insert and come back as a retryable
conflict (409).
"""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_auth import CSRF, FakeKeys, _callback, _start, make_id_token

ACCESS_COOKIE = "journal_access"


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


def _sign_in(client: TestClient, monkeypatch: pytest.MonkeyPatch, sub: str) -> str:
    client.cookies.clear()
    state, nonce = _start(client)
    response = _callback(
        client, state, monkeypatch, nonce=nonce, id_token=make_id_token(sub=sub, nonce=nonce)
    )
    assert response.status_code == 303, response.text
    return str(client.get("/api/v1/me").json()["id"])


def _body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "client_id": str(uuid.uuid4()),
        "meal_type": "lunch",
        "eaten_at": "2026-10-31T12:00:00Z",
        "name": "Dal",
        "calories": 300,
        "protein_g": 12,
        "carbs_g": 40,
        "fat_g": 8,
        "source": "manual",
    }
    body.update(overrides)
    return body


def _post(client: TestClient, body: dict[str, Any], expected: str | None) -> Any:
    headers = {**CSRF, "Idempotency-Key": body["client_id"]}
    if expected is not None:
        headers["X-Journal-Expected-Account"] = expected
    return client.post("/api/v1/meals", json=body, headers=headers)


async def _rows_for(engine: AsyncEngine, client_id: str) -> int:
    async with engine.connect() as conn:
        result = await conn.execute(
            text("select count(*) from meals where client_id = :c"), {"c": client_id}
        )
        return int(result.scalar_one())


def test_a_copied_cookie_of_a_deleted_account_is_refused_as_unauthenticated(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    old_account = _sign_in(client, monkeypatch, "sub-old")
    old_cookie = client.cookies.get(ACCESS_COOKIE)
    assert old_cookie is not None
    assert client.delete("/api/v1/me", headers=CSRF).status_code == 204

    # The copied cookie is presented again, as a stale browser tab or a copied token would.
    client.cookies.set(ACCESS_COOKIE, old_cookie)
    body = _body()
    response = _post(client, body, old_account)

    assert response.status_code == 401, response.text
    assert run(lambda engine: _rows_for(engine, body["client_id"])) == 0
    assert client.get("/api/v1/me").status_code == 401


def test_a_deleted_account_cannot_persist_or_replay_into_a_newly_registered_account(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    old_account = _sign_in(client, monkeypatch, "sub-same")
    old_cookie = client.cookies.get(ACCESS_COOKIE)
    assert old_cookie is not None
    assert client.delete("/api/v1/me", headers=CSRF).status_code == 204
    new_account = _sign_in(client, monkeypatch, "sub-same")
    assert new_account != old_account

    client.cookies.set(ACCESS_COOKIE, old_cookie)
    stale = _body()

    # The stale cookie identifies the deleted account, whatever id the request names.
    # So it is refused as unauthenticated, independent of the expected-account header.
    replay = _post(client, stale, new_account)
    assert replay.status_code == 401, replay.text
    own = _post(client, stale, old_account)
    assert own.status_code == 401, own.text
    assert run(lambda engine: _rows_for(engine, stale["client_id"])) == 0


def test_logout_clears_cookies_for_a_deleted_account_and_revokes_nothing_it_cannot_reach(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch, "sub-logout-deleted")
    access = client.cookies.get(ACCESS_COOKIE)
    refresh = client.cookies.get("journal_refresh")
    assert access is not None
    assert refresh is not None
    assert client.delete("/api/v1/me", headers=CSRF).status_code == 204

    client.cookies.set(ACCESS_COOKIE, access)
    client.cookies.set("journal_refresh", refresh)
    response = client.post("/api/v1/auth/logout", headers=CSRF)

    assert response.status_code == 204, response.text
    cleared = " ".join(response.headers.get_list("set-cookie"))
    assert f"{ACCESS_COOKIE}=" in cleared
    assert "Max-Age=0" in cleared


def test_logout_with_an_expired_access_token_revokes_the_family_and_clears_cookies(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    from app.auth.tokens import issue_access_token, signing_key

    account = _sign_in(client, monkeypatch, "sub-expired")
    refresh = client.cookies.get("journal_refresh")
    assert refresh is not None
    expired = issue_access_token(account, signing_key(settings.jwt_secret), ttl_seconds=-60)

    client.cookies.set(ACCESS_COOKIE, expired)
    client.cookies.set("journal_refresh", refresh)
    response = client.post("/api/v1/auth/logout", headers=CSRF)

    assert response.status_code == 204, response.text
    assert "Max-Age=0" in " ".join(response.headers.get_list("set-cookie"))
    # The refresh token from before logout must now be refused: its family was revoked.
    client.cookies.set("journal_refresh", refresh)
    client.cookies.delete(ACCESS_COOKIE)
    assert client.post("/api/v1/auth/refresh", headers=CSRF).status_code == 401


def test_logout_still_needs_the_csrf_header(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch, "sub-csrf")
    assert client.post("/api/v1/auth/logout").status_code == 403


def test_logout_with_no_session_cookie_is_still_refused(client: TestClient) -> None:
    client.cookies.clear()
    assert client.post("/api/v1/auth/logout", headers=CSRF).status_code == 401


def test_a_tampered_access_cookie_alone_is_refused_and_clears_nothing(client: TestClient) -> None:
    from app.auth.tokens import issue_access_token

    forged = issue_access_token(
        "usr_not_real", "some-other-key-that-is-long-enough-to-pass-the-check", 600
    )
    client.cookies.clear()
    client.cookies.set(ACCESS_COOKIE, forged)
    response = client.post("/api/v1/auth/logout", headers=CSRF)

    assert response.status_code == 401, response.text
    assert "set-cookie" not in response.headers


def test_an_unknown_refresh_cookie_alone_is_refused_and_clears_nothing(client: TestClient) -> None:
    client.cookies.clear()
    client.cookies.set("journal_refresh", "never-issued-by-this-server")
    response = client.post("/api/v1/auth/logout", headers=CSRF)

    assert response.status_code == 401, response.text
    assert "set-cookie" not in response.headers


def test_anonymous_logout_is_401_even_without_a_signing_key(
    app: FastAPI, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    client.cookies.clear()
    monkeypatch.setattr(app.state.settings, "jwt_secret", None)
    assert client.post("/api/v1/auth/logout", headers=CSRF).status_code == 401
