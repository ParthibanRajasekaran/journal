"""Attempt-bound native sign-in against PostgreSQL (spike).

The token is a locally signed test token, so this proves the nonce binding, the transaction and the
bearer path. It does NOT prove Google's real tokens, which are pending the owner's OAuth clients.
See docs/factory/proposals/native-auth/EVIDENCE.md."""

import asyncio
import uuid
from collections.abc import Iterator
from typing import Any, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app import native_attempts
from app.auth import service as auth_service
from app.config import Settings
from app.db.models import NativeAttempt, RefreshToken, User
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_auth import CSRF, FakeKeys, make_id_token


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


def start(client: TestClient) -> dict[str, Any]:
    response = client.post("/api/v1/auth/native/attempts", headers=CSRF)
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


def complete(
    client: TestClient,
    attempt: dict[str, Any],
    token: str,
    adult: bool = True,
    secret: str | None = None,
) -> Response:
    body = {
        "attempt_secret": secret or attempt["attempt_secret"],
        "id_token": token,
        "adult": adult,
    }
    return cast(Response, client.post("/api/v1/auth/native/complete", json=body, headers=CSRF))


def row(secret: str) -> NativeAttempt | None:
    async def go(engine: AsyncEngine) -> NativeAttempt | None:
        async with engine.begin() as conn:
            session = AsyncSession(bind=conn)
            return await session.get(NativeAttempt, native_attempts.digest(secret))

    return run(go)


def count(model: type[Any]) -> int:
    async def go(engine: AsyncEngine) -> int:
        async with engine.begin() as conn:
            return int((await conn.execute(select(func.count()).select_from(model))).scalar_one())

    return run(go)


def user_exists(sub: str) -> bool:
    async def go(engine: AsyncEngine) -> int:
        async with engine.begin() as conn:
            found = await conn.execute(
                select(func.count()).select_from(User).where(User.google_sub == sub)
            )
            return int(found.scalar_one())

    return run(go) > 0


def state_of(secret: str) -> str | None:
    found = row(secret)
    return None if found is None else str(found.state)


def test_the_attempt_stores_a_hash_of_the_secret_and_returns_the_nonce(client: TestClient) -> None:
    attempt = start(client)
    stored = row(attempt["attempt_secret"])
    assert stored is not None
    assert stored.attempt_hash == native_attempts.digest(attempt["attempt_secret"])
    assert attempt["attempt_secret"] not in stored.attempt_hash
    assert stored.nonce == attempt["nonce"]
    assert stored.state == "pending"


def test_a_matching_token_signs_in_and_the_bearer_token_works(client: TestClient) -> None:
    attempt = start(client)
    response = complete(client, attempt, make_id_token(sub="sub-a", nonce=attempt["nonce"]))
    assert response.status_code == 200, response.text
    tokens = response.json()
    assert state_of(attempt["attempt_secret"]) == "consumed"
    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200, me.text


def test_a_token_from_attempt_a_cannot_complete_attempt_b(client: TestClient) -> None:
    a = start(client)
    b = start(client)
    response = complete(client, b, make_id_token(sub="sub-a", nonce=a["nonce"]))
    assert response.status_code == 401
    assert state_of(b["attempt_secret"]) == "pending"
    assert count(RefreshToken) == 0


def test_a_missing_nonce_is_refused(client: TestClient) -> None:
    attempt = start(client)
    assert complete(client, attempt, make_id_token(sub="sub-a", nonce=None)).status_code == 401
    assert state_of(attempt["attempt_secret"]) == "pending"


def test_an_incorrect_nonce_is_refused(client: TestClient) -> None:
    attempt = start(client)
    assert (
        complete(client, attempt, make_id_token(sub="sub-a", nonce="not-issued")).status_code == 401
    )


def test_an_unknown_attempt_secret_is_refused(client: TestClient) -> None:
    attempt = start(client)
    fake_secret = "x" * 43
    response = complete(
        client, attempt, make_id_token(sub="sub-a", nonce=attempt["nonce"]), secret=fake_secret
    )
    assert response.status_code == 401


def test_an_expired_attempt_is_refused(client: TestClient) -> None:
    attempt = start(client)

    async def expire(engine: AsyncEngine) -> None:
        async with engine.begin() as conn:
            from datetime import UTC, datetime, timedelta

            from sqlalchemy import update

            await conn.execute(
                update(NativeAttempt)
                .where(
                    NativeAttempt.attempt_hash == native_attempts.digest(attempt["attempt_secret"])
                )
                .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
            )

    run(expire)
    response = complete(client, attempt, make_id_token(sub="sub-a", nonce=attempt["nonce"]))
    assert response.status_code == 401


def test_a_consumed_attempt_cannot_complete_again(client: TestClient) -> None:
    attempt = start(client)
    token = make_id_token(sub="sub-a", nonce=attempt["nonce"])
    assert complete(client, attempt, token).status_code == 200
    assert complete(client, attempt, token).status_code == 401


def test_a_cancelled_attempt_is_refused_and_a_fresh_login_works(client: TestClient) -> None:
    cancelled = start(client)
    assert (
        client.post(
            "/api/v1/auth/native/attempts/cancel",
            json={"attempt_secret": cancelled["attempt_secret"]},
            headers=CSRF,
        ).status_code
        == 204
    )
    assert state_of(cancelled["attempt_secret"]) == "cancelled"
    assert (
        complete(
            client, cancelled, make_id_token(sub="sub-a", nonce=cancelled["nonce"])
        ).status_code
        == 401
    )
    fresh = start(client)
    assert (
        complete(client, fresh, make_id_token(sub="sub-a", nonce=fresh["nonce"])).status_code == 200
    )


def test_a_refused_token_does_not_consume_the_attempt(client: TestClient) -> None:
    attempt = start(client)
    assert complete(client, attempt, make_id_token(sub="sub-a", nonce="wrong")).status_code == 401
    assert (
        complete(client, attempt, make_id_token(sub="sub-a", nonce=attempt["nonce"])).status_code
        == 200
    )


def test_a_failed_session_rolls_back_the_consumption_and_the_user(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    attempt = start(client)

    async def broken_session(*args: object, **kwargs: object) -> None:
        raise RuntimeError("session store unavailable")

    monkeypatch.setattr(auth_service, "start_session", broken_session)
    unsafe = TestClient(client.app, raise_server_exceptions=False)
    response = complete(unsafe, attempt, make_id_token(sub="sub-rollback", nonce=attempt["nonce"]))
    assert response.status_code == 500
    assert state_of(attempt["attempt_secret"]) == "pending", (
        "consumption must roll back with the session"
    )
    assert count(RefreshToken) == 0
    assert not user_exists("sub-rollback"), "the user row must roll back with the session"


def test_a_new_account_without_the_18_plus_confirmation_creates_nothing(client: TestClient) -> None:
    attempt = start(client)
    response = complete(
        client, attempt, make_id_token(sub="sub-minor", nonce=attempt["nonce"]), adult=False
    )
    assert response.status_code == 409
    assert state_of(attempt["attempt_secret"]) == "pending"
    assert not user_exists("sub-minor")
    assert count(RefreshToken) == 0


def test_concurrent_completions_consume_the_attempt_exactly_once_in_postgres() -> None:
    secret, nonce = native_attempts.new_attempt()

    async def go(engine: AsyncEngine) -> list[bool]:
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as s, s.begin():
            await native_attempts.add_attempt(s, secret, nonce)

        async def one() -> bool:
            async with factory() as s, s.begin():
                return await native_attempts.consume_attempt(s, secret)

        return await asyncio.gather(*(one() for _ in range(12)))

    results = run(go)
    assert sum(results) == 1, results


def test_refresh_rotates_reuse_revokes_and_logout_ends_the_session(client: TestClient) -> None:
    attempt = start(client)
    tokens = complete(client, attempt, make_id_token(sub="sub-r", nonce=attempt["nonce"])).json()
    rotated = client.post(
        "/api/v1/auth/native/refresh", json={"refresh_token": tokens["refresh_token"]}, headers=CSRF
    )
    assert rotated.status_code == 200, rotated.text
    new = rotated.json()
    assert new["refresh_token"] != tokens["refresh_token"]
    # Presenting the rotated token again revokes the family, including the new token.
    assert (
        client.post(
            "/api/v1/auth/native/refresh",
            json={"refresh_token": tokens["refresh_token"]},
            headers=CSRF,
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/native/refresh",
            json={"refresh_token": new["refresh_token"]},
            headers=CSRF,
        ).status_code
        == 401
    )


def test_logout_revokes_the_native_session(client: TestClient) -> None:
    attempt = start(client)
    tokens = complete(client, attempt, make_id_token(sub="sub-l", nonce=attempt["nonce"])).json()
    assert (
        client.post(
            "/api/v1/auth/native/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers=CSRF,
        ).status_code
        == 204
    )
    assert (
        client.post(
            "/api/v1/auth/native/refresh",
            json={"refresh_token": tokens["refresh_token"]},
            headers=CSRF,
        ).status_code
        == 401
    )


def test_a_bearer_token_does_not_bypass_the_csrf_header_on_writes(client: TestClient) -> None:
    attempt = start(client)
    tokens = complete(client, attempt, make_id_token(sub="sub-c", nonce=attempt["nonce"])).json()
    body = {
        "client_id": str(uuid.uuid4()),
        "meal_type": "lunch",
        "eaten_at": "2026-11-01T12:00:00Z",
        "name": "Dal",
        "calories": 300,
        "protein_g": 12,
        "carbs_g": 40,
        "fat_g": 8,
        "source": "manual",
    }
    headers = {
        "Authorization": f"Bearer {tokens['access_token']}",
        "Idempotency-Key": body["client_id"],
    }
    assert client.post("/api/v1/meals", json=body, headers=headers).status_code == 403


def test_bearer_sessions_create_reopen_and_stay_isolated_per_account(client: TestClient) -> None:
    def bearer_for(sub: str) -> dict[str, str]:
        attempt = start(client)
        tokens = complete(client, attempt, make_id_token(sub=sub, nonce=attempt["nonce"])).json()
        return {"Authorization": f"Bearer {tokens['access_token']}"}

    a, b = bearer_for("sub-meal-a"), bearer_for("sub-meal-b")
    body = {
        "client_id": str(uuid.uuid4()),
        "meal_type": "lunch",
        "eaten_at": "2026-11-01T12:00:00Z",
        "name": "Dal",
        "calories": 300,
        "protein_g": 12,
        "carbs_g": 40,
        "fat_g": 8,
        "source": "manual",
    }
    created = client.post(
        "/api/v1/meals", json=body, headers={**a, **CSRF, "Idempotency-Key": body["client_id"]}
    )
    assert created.status_code == 201, created.text
    reopened = client.get("/api/v1/meals", headers=a).json()["items"]
    assert [m["client_id"] for m in reopened] == [body["client_id"]]
    assert client.get("/api/v1/meals", headers=b).json()["items"] == []
