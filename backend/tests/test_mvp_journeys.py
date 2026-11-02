"""MVP user journeys on the integration backend, with synthetic accounts and test signing keys.

Labelled synthetic: the ID tokens are signed by the test key set (FakeKeys), not by Google.
These journeys prove the server side of each journey with the native bearer session.
Real Google sign-in and the device-side journeys are separate evidence, not claimed here.
"""

import uuid
from collections.abc import Iterator
from typing import Any, cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
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


def sign_in(client: TestClient, sub: str) -> dict[str, Any]:
    """Native sign-in: start an attempt, then complete it with a test token bound to its nonce."""
    attempt = client.post("/api/v1/auth/native/attempts", headers=CSRF)
    assert attempt.status_code == 201, attempt.text
    attempt_body = attempt.json()
    done = client.post(
        "/api/v1/auth/native/complete",
        json={
            "attempt_secret": attempt_body["attempt_secret"],
            "id_token": make_id_token(sub=sub, nonce=attempt_body["nonce"]),
            "adult": True,
        },
        headers=CSRF,
    )
    assert done.status_code == 200, done.text
    return cast(dict[str, Any], done.json())


def bearer(tokens: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def write_headers(tokens: dict[str, Any], key: str) -> dict[str, str]:
    return {**bearer(tokens), **CSRF, "Idempotency-Key": key}


def meal_body(client_id: str | None = None, name: str = "Dal") -> dict[str, Any]:
    return {
        "client_id": client_id or str(uuid.uuid4()),
        "meal_type": "lunch",
        "eaten_at": "2026-11-02T12:00:00Z",
        "name": name,
        "calories": 300,
        "protein_g": 12,
        "carbs_g": 40,
        "fat_g": 8,
        "source": "manual",
    }


def saved_ids(client: TestClient, tokens: dict[str, Any]) -> list[str]:
    return [
        m["client_id"] for m in client.get("/api/v1/meals", headers=bearer(tokens)).json()["items"]
    ]


def test_journey_sign_in_then_create_edit_and_reopen_a_meal(client: TestClient) -> None:
    tokens = sign_in(client, "synthetic-sub-create")
    body = meal_body(name="Dal")
    created = client.post(
        "/api/v1/meals", json=body, headers=write_headers(tokens, body["client_id"])
    )
    assert created.status_code == 201, created.text
    meal = created.json()

    edited = client.patch(
        f"/api/v1/meals/{meal['id']}",
        json={"name": "Dal and rice", "calories": 420},
        headers={**write_headers(tokens, body["client_id"]), "If-Match": str(meal["version"])},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["name"] == "Dal and rice"

    reopened = client.get("/api/v1/meals", headers=bearer(tokens)).json()["items"]
    assert [(m["client_id"], m["name"], m["calories"]) for m in reopened] == [
        (body["client_id"], "Dal and rice", 420)
    ]


def test_journey_session_is_restored_from_the_refresh_token_after_a_restart(
    client: TestClient,
) -> None:
    tokens = sign_in(client, "synthetic-sub-restore")
    # The app keeps only the refresh token across a restart, then exchanges it for a new access
    # token.
    renewed = client.post(
        "/api/v1/auth/native/refresh", json={"refresh_token": tokens["refresh_token"]}, headers=CSRF
    )
    assert renewed.status_code == 200, renewed.text
    fresh = renewed.json()
    assert client.get("/api/v1/me", headers=bearer(fresh)).status_code == 200


def test_journey_offline_save_replayed_on_reconnect_creates_one_meal(client: TestClient) -> None:
    tokens = sign_in(client, "synthetic-sub-offline")
    body = meal_body(name="Offline toast")
    first = client.post(
        "/api/v1/meals", json=body, headers=write_headers(tokens, body["client_id"])
    )
    assert first.status_code == 201, first.text
    # The outbox resends the same client_id after reconnecting, possibly more than once.
    for _ in range(2):
        again = client.post(
            "/api/v1/meals", json=body, headers=write_headers(tokens, body["client_id"])
        )
        assert again.status_code == 200, again.text
        assert again.json()["id"] == first.json()["id"]
    assert saved_ids(client, tokens) == [body["client_id"]]


def test_journey_logout_ends_the_native_session(client: TestClient) -> None:
    tokens = sign_in(client, "synthetic-sub-logout")
    out = client.post(
        "/api/v1/auth/native/logout", json={"refresh_token": tokens["refresh_token"]}, headers=CSRF
    )
    assert out.status_code == 204, out.text
    refused = client.post(
        "/api/v1/auth/native/refresh", json={"refresh_token": tokens["refresh_token"]}, headers=CSRF
    )
    assert refused.status_code == 401


def test_journey_account_switching_keeps_each_accounts_meals_separate(client: TestClient) -> None:
    alice = sign_in(client, "synthetic-sub-alice")
    alice_meal = meal_body(name="Alice lunch")
    assert (
        client.post(
            "/api/v1/meals", json=alice_meal, headers=write_headers(alice, alice_meal["client_id"])
        ).status_code
        == 201
    )

    bob = sign_in(client, "synthetic-sub-bob")
    assert saved_ids(client, bob) == []
    bob_meal = meal_body(name="Bob dinner")
    assert (
        client.post(
            "/api/v1/meals", json=bob_meal, headers=write_headers(bob, bob_meal["client_id"])
        ).status_code
        == 201
    )
    assert saved_ids(client, bob) == [bob_meal["client_id"]]
    assert saved_ids(client, alice) == [alice_meal["client_id"]]


def test_journey_deleted_account_is_refused_and_a_new_registration_starts_empty(
    client: TestClient,
) -> None:
    gone = sign_in(client, "synthetic-sub-deleted")
    stale = meal_body(name="Queued before deletion")
    assert (
        client.post(
            "/api/v1/meals", json=stale, headers=write_headers(gone, stale["client_id"])
        ).status_code
        == 201
    )
    assert client.delete("/api/v1/me", headers={**bearer(gone), **CSRF}).status_code == 204

    # The deleted account's token is refused cleanly, nothing is sent, and nothing is replayed.
    refused = client.post(
        "/api/v1/meals", json=meal_body(), headers=write_headers(gone, str(uuid.uuid4()))
    )
    assert refused.status_code == 401, refused.text
    assert client.get("/api/v1/me", headers=bearer(gone)).status_code == 401

    # The same sign-in subject registers again as a new account with no meals.
    again = sign_in(client, "synthetic-sub-deleted")
    assert saved_ids(client, again) == []
