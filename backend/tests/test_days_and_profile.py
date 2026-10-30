"""Day and week totals, profile edits, and account deletion."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_auth import CSRF, FakeKeys, _callback, _start, make_id_token
from tests.test_meals import _create, _meal_body


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
    assert response.status_code == 303


def test_day_totals_add_up_and_only_include_that_day(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _create(
        client,
        _meal_body(
            eaten_at="2026-10-29T08:00:00Z", calories=300, protein_g=10, carbs_g=40, fat_g=5
        ),
    )
    _create(
        client,
        _meal_body(
            eaten_at="2026-10-29T19:00:00Z", calories=500, protein_g=30, carbs_g=50, fat_g=15
        ),
    )
    _create(client, _meal_body(eaten_at="2026-10-28T19:00:00Z", calories=900))

    day = client.get("/api/v1/days/2026-10-29").json()
    assert day["date"] == "2026-10-29"
    assert day["meal_count"] == 2
    assert day["calories"] == 800
    assert day["protein_g"] == 40
    assert len(day["meals"]) == 2


def test_week_has_seven_days_with_zero_days_filled_in(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _create(client, _meal_body(eaten_at="2026-10-27T12:00:00Z", calories=400))
    week = client.get("/api/v1/week", params={"start": "2026-10-26"}).json()
    assert len(week) == 7
    assert [d["date"] for d in week][0] == "2026-10-26"
    assert week[1]["calories"] == 400
    assert week[0]["meal_count"] == 0


def test_day_and_week_never_show_another_users_meals(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _create(client, _meal_body(eaten_at="2026-10-29T12:00:00Z", calories=700))
    _sign_in_as(client, monkeypatch, "someone-else")
    assert client.get("/api/v1/days/2026-10-29").json()["meal_count"] == 0
    assert all(
        d["meal_count"] == 0
        for d in client.get("/api/v1/week", params={"start": "2026-10-26"}).json()
    )


def test_profile_targets_are_saved_and_validated(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    saved = client.patch(
        "/api/v1/me",
        json={"display_name": "Parthiban", "daily_targets": {"calories": 2100, "protein_g": 120}},
        headers=CSRF,
    )
    assert saved.status_code == 200
    assert saved.json()["daily_targets"] == {"calories": 2100, "protein_g": 120.0}
    assert (
        client.patch(
            "/api/v1/me", json={"daily_targets": {"calories": 100}}, headers=CSRF
        ).status_code
        == 422
    )


def test_deleting_the_account_removes_meals_and_ends_the_session(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _create(client, _meal_body())
    assert client.delete("/api/v1/me", headers=CSRF).status_code == 204
    assert client.get("/api/v1/me").status_code == 401

    _sign_in_as(client, monkeypatch, "owner-a")
    assert client.get("/api/v1/meals").json()["items"] == []
