"""Concurrent creates with one owner and one client_id, on the real PostgreSQL test database.

Each thread sends at the same moment, behind a barrier, so the unique constraint on
(user, client_id) is really raced. Whatever the timing, exactly one meal is stored.
Every response matches the documented results: the same meal is a replay (200 or 201),
and a different meal is a conflict (409).
"""

import threading
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
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

THREADS = 12
CONFLICT = "This key was used for a different meal."


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


def _post(client: TestClient, body: dict[str, Any]) -> Any:
    headers = {**CSRF, "Idempotency-Key": body["client_id"]}
    return client.post("/api/v1/meals", json=body, headers=headers)


def _race(client: TestClient, bodies: list[dict[str, Any]]) -> list[Any]:
    """Sends one request per body from separate threads, all released at the same moment."""
    barrier = threading.Barrier(len(bodies))

    def send(body: dict[str, Any]) -> Any:
        barrier.wait()
        return _post(client, body)

    with ThreadPoolExecutor(max_workers=len(bodies)) as pool:
        return list(pool.map(send, bodies))


async def _stored(engine: AsyncEngine, client_id: str) -> list[tuple[str, str]]:
    async with engine.connect() as conn:
        result = await conn.execute(
            text("select id::text, name from meals where client_id = :c"), {"c": client_id}
        )
        return [(row[0], row[1]) for row in result.all()]


def test_identical_concurrent_creates_store_one_meal_and_each_gets_the_replay(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch, "sub-race")
    body = _body()

    responses = _race(client, [body] * THREADS)

    assert {r.status_code for r in responses} <= {200, 201}, [r.text for r in responses]
    assert sum(1 for r in responses if r.status_code == 201) == 1
    assert len({r.json()["id"] for r in responses}) == 1
    stored = run(lambda engine: _stored(engine, body["client_id"]))
    assert len(stored) == 1
    assert stored[0][0] == responses[0].json()["id"]


def test_conflicting_concurrent_payloads_store_one_meal_and_refuse_the_others(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch, "sub-conflict")
    first = _body()
    second = _body(client_id=first["client_id"], name="Something else")
    bodies = [first if i % 2 == 0 else second for i in range(THREADS)]

    responses = _race(client, bodies)

    stored = run(lambda engine: _stored(engine, first["client_id"]))
    assert len(stored) == 1
    stored_id, stored_name = stored[0]
    for body, response in zip(bodies, responses, strict=True):
        if body["name"] == stored_name:
            assert response.status_code in (200, 201), response.text
            assert response.json()["id"] == stored_id
        else:
            assert response.status_code == 409, response.text
            assert response.json()["detail"] == CONFLICT
