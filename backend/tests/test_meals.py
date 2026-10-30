"""Meals behaviour: ownership, idempotent creates, version checks, validation, CSRF, filters."""

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


def _sign_in_as(client: TestClient, monkeypatch: pytest.MonkeyPatch, sub: str) -> None:
    client.cookies.clear()
    state, nonce = _start(client)
    response = _callback(
        client, state, monkeypatch, nonce=nonce, id_token=make_id_token(sub=sub, nonce=nonce)
    )
    assert response.status_code == 303, response.text


def _meal_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "client_id": str(uuid.uuid4()),
        "meal_type": "breakfast",
        "eaten_at": "2026-10-29T08:12:00Z",
        "name": "Oatmeal with banana",
        "calories": 352,
        "protein_g": 11.8,
        "carbs_g": 61,
        "fat_g": 6.2,
        "source": "ai_confirmed",
    }
    body.update(overrides)
    return body


def _create(client: TestClient, body: dict[str, Any], key: str | None = None) -> Any:
    headers = {**CSRF, "Idempotency-Key": key or body["client_id"]}
    return client.post("/api/v1/meals", json=body, headers=headers)


# --- creating ----------------------------------------------------------------------------


def test_create_returns_201_with_location(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    response = _create(client, _meal_body())
    assert response.status_code == 201
    assert response.json()["id"].startswith("meal_")
    assert response.headers["location"] == f"/api/v1/meals/{response.json()['id']}"


def test_replaying_the_same_create_returns_the_same_meal(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    body = _meal_body()
    first = _create(client, body).json()
    replay = _create(client, body)
    assert replay.status_code == 200
    assert replay.json()["id"] == first["id"]


def test_same_key_with_a_different_meal_is_a_conflict(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    body = _meal_body()
    _create(client, body)
    changed = _meal_body(client_id=body["client_id"], name="Something else")
    assert _create(client, changed).status_code == 409


def test_idempotency_key_must_match_client_id(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    response = _create(client, _meal_body(), key=str(uuid.uuid4()))
    assert response.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [
        {"calories": -1},
        {"calories": 5001},
        {"protein_g": 301},
        {"meal_type": "brunch"},
        {"source": "guessed"},
        {"name": ""},
        {"photo_id": "not-a-photo"},
        {"unexpected_field": "x"},
    ],
)
def test_invalid_meals_are_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, overrides: dict[str, Any]
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    response = _create(client, _meal_body(**overrides))
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


def test_create_without_csrf_header_is_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    body = _meal_body()
    response = client.post(
        "/api/v1/meals", json=body, headers={"Idempotency-Key": body["client_id"]}
    )
    assert response.status_code == 403


# --- ownership ---------------------------------------------------------------------------


def test_another_user_cannot_see_or_change_a_meal(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    meal_id = _create(client, _meal_body()).json()["id"]

    _sign_in_as(client, monkeypatch, "someone-else")
    assert client.get(f"/api/v1/meals/{meal_id}").status_code == 404
    assert (
        client.patch(
            f"/api/v1/meals/{meal_id}", json={"name": "x"}, headers={**CSRF, "If-Match": "1"}
        ).status_code
        == 404
    )
    assert client.delete(f"/api/v1/meals/{meal_id}", headers=CSRF).status_code == 404
    assert client.get("/api/v1/meals").json()["items"] == []


# --- editing and deleting ----------------------------------------------------------------


def test_edit_requires_the_current_version(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    meal = _create(client, _meal_body()).json()
    url = f"/api/v1/meals/{meal['id']}"

    stale = client.patch(url, json={"name": "Porridge"}, headers={**CSRF, "If-Match": "99"})
    assert stale.status_code == 412

    edited = client.patch(url, json={"name": "Porridge"}, headers={**CSRF, "If-Match": "1"})
    assert edited.status_code == 200
    assert edited.json()["name"] == "Porridge"
    assert edited.json()["version"] == 2


def test_edit_with_no_fields_is_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    meal = _create(client, _meal_body()).json()
    response = client.patch(
        f"/api/v1/meals/{meal['id']}", json={}, headers={**CSRF, "If-Match": "1"}
    )
    assert response.status_code == 422


def test_delete_removes_the_meal(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    meal_id = _create(client, _meal_body()).json()["id"]
    assert client.delete(f"/api/v1/meals/{meal_id}", headers=CSRF).status_code == 204
    assert client.get(f"/api/v1/meals/{meal_id}").status_code == 404


# --- listing -----------------------------------------------------------------------------


def test_list_filters_by_day_and_pages(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _create(client, _meal_body(eaten_at="2026-10-28T08:00:00Z"))
    _create(client, _meal_body(eaten_at="2026-10-29T08:00:00Z"))
    _create(client, _meal_body(eaten_at="2026-10-29T19:00:00Z"))

    day = client.get("/api/v1/meals", params={"date": "2026-10-29"}).json()
    assert len(day["items"]) == 2
    assert all(item["eaten_at"].startswith("2026-10-29") for item in day["items"])

    first = client.get("/api/v1/meals", params={"limit": 2}).json()
    assert len(first["items"]) == 2
    assert first["next_cursor"] == "2"
    second = client.get("/api/v1/meals", params={"limit": 2, "cursor": first["next_cursor"]}).json()
    assert len(second["items"]) == 1
    assert second["next_cursor"] is None


def test_cursor_must_be_a_number(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    assert client.get("/api/v1/meals", params={"cursor": "abc"}).status_code == 422


# --- readiness ---------------------------------------------------------------------------


def test_readiness_reports_ready_when_the_database_answers(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readiness_reports_unavailable_when_the_database_is_unreachable(settings: Settings) -> None:
    broken = settings.model_copy(
        update={"database_url": "postgresql+asyncpg://127.0.0.1:5999/nowhere"}
    )
    with TestClient(create_app(broken)) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
