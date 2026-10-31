"""Expected-account binding for meal creates (review R2).

A client that queued a write for account A sends X-Journal-Expected-Account: A. The server decides
against the session it authenticates for that same request. If the session now belongs to another
account (another tab signed in, logout, deletion), nothing is written and the response says so. The
client cannot make this atomic on its own, so these tests exercise the server.
"""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_auth import CSRF, FakeKeys, _callback, _start, make_id_token

EXPECTED = "X-Journal-Expected-Account"


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


def _sign_in_as(client: TestClient, monkeypatch: pytest.MonkeyPatch, sub: str) -> str:
    """Signs the client's cookie jar in as `sub` and returns that account's id."""
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


def _create(client: TestClient, body: dict[str, Any], expected: str | None) -> Any:
    headers = {**CSRF, "Idempotency-Key": body["client_id"]}
    if expected is not None:
        headers[EXPECTED] = expected
    return client.post("/api/v1/meals", json=body, headers=headers)


def _saved_client_ids(client: TestClient) -> set[str]:
    """Every meal the current session can see. Read-only, so checking never creates anything."""
    items = client.get("/api/v1/meals", params={"limit": 100}).json()["items"]
    return {item["client_id"] for item in items}


def test_matching_expected_account_creates_the_meal(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    account = _sign_in_as(client, monkeypatch, "sub-a")
    body = _body()
    assert _create(client, body, account).status_code == 201


def test_expected_account_of_another_user_is_refused_and_nothing_is_written(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_a = _sign_in_as(client, monkeypatch, "sub-a")
    owner_b = _sign_in_as(client, monkeypatch, "sub-b")
    assert owner_a != owner_b
    body = _body()

    response = _create(client, body, owner_a)

    assert response.status_code == 409
    assert "Nothing was saved" in response.json()["detail"]
    assert body["client_id"] not in _saved_client_ids(client)


def test_cross_tab_switch_refuses_a_queued_write_and_writes_only_for_the_session_owner(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Tab 1 queued a meal for A and sends it after tab 2 has signed in as B on the same cookie jar.
    owner_a = _sign_in_as(client, monkeypatch, "sub-a")
    body_a = _body()
    client.cookies.clear()
    owner_b = _sign_in_as(client, monkeypatch, "sub-b")

    assert _create(client, body_a, owner_a).status_code == 409
    b_body = _body()
    assert _create(client, b_body, owner_b).status_code == 201
    assert body_a["client_id"] not in _saved_client_ids(client)
    assert b_body["client_id"] in _saved_client_ids(client)


def test_logout_refuses_the_queued_write(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_a = _sign_in_as(client, monkeypatch, "sub-a")
    client.post("/api/v1/auth/logout", headers=CSRF)

    response = _create(client, _body(), owner_a)

    assert response.status_code == 401


def test_deleted_account_refuses_the_queued_write(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner_a = _sign_in_as(client, monkeypatch, "sub-a")
    assert client.delete("/api/v1/me", headers=CSRF).status_code == 204

    response = _create(client, _body(), owner_a)

    assert response.status_code == 401


def test_malformed_expected_account_is_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "sub-a")
    assert _create(client, _body(), "bad id!").status_code == 422


def test_requests_without_the_header_behave_as_before(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "sub-a")
    assert _create(client, _body(), None).status_code == 201
