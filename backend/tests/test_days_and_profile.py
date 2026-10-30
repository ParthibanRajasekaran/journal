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


def test_drinks_and_other_intake_can_be_logged_as_their_own_meal(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    response = _create(client, _meal_body(meal_type="other", name="Green tea"))
    assert response.status_code == 201
    assert response.json()["meal_type"] == "other"


def test_buddy_encouragement_is_on_by_default_and_can_be_switched_off(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    assert client.get("/api/v1/me").json()["encouragement_enabled"] is True

    off = client.patch("/api/v1/me", json={"encouragement_enabled": False}, headers=CSRF)
    assert off.status_code == 200
    assert off.json()["encouragement_enabled"] is False

    # Switching it off leaves the targets alone, and it stays off on the next visit.
    assert client.get("/api/v1/me").json()["encouragement_enabled"] is False

    client.patch("/api/v1/me", json={"encouragement_enabled": True}, headers=CSRF)
    assert client.get("/api/v1/me").json()["encouragement_enabled"] is True


def test_deleting_the_account_removes_meals_and_ends_the_session(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _create(client, _meal_body())
    assert client.delete("/api/v1/me", headers=CSRF).status_code == 204
    assert client.get("/api/v1/me").status_code == 401

    _sign_in_as(client, monkeypatch, "owner-a")
    assert client.get("/api/v1/meals").json()["items"] == []


def test_write_burst_is_limited_per_user(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    limited = settings.model_copy(update={"write_requests_per_minute": 3})
    application = create_app(limited)
    application.state.jwks = FakeKeys()
    with TestClient(application, follow_redirects=False) as client:
        _sign_in_as(client, monkeypatch, "burst-user")
        statuses = [
            client.patch("/api/v1/me", json={"display_name": "x"}, headers=CSRF).status_code
            for _ in range(5)
        ]
    assert statuses[:3] == [200, 200, 200]
    assert statuses[3:] == [429, 429]


def test_daily_meal_cap_refuses_new_meals_but_not_replays(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    capped = settings.model_copy(update={"meals_per_day": 2, "write_requests_per_minute": 1000})
    application = create_app(capped)
    application.state.jwks = FakeKeys()
    with TestClient(application, follow_redirects=False) as client:
        _sign_in_as(client, monkeypatch, "capped-user")
        first = _meal_body()
        assert _create(client, first).status_code == 201
        assert _create(client, _meal_body()).status_code == 201
        assert _create(client, _meal_body()).status_code == 429
        assert _create(client, first).status_code == 200


@pytest.mark.parametrize("path", ["/api/v1/days/9999-12-31", "/api/v1/days/0001-01-01"])
def test_extreme_dates_are_refused_not_crashed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    assert client.get(path).status_code == 422


def test_extreme_week_start_is_refused(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    assert client.get("/api/v1/week", params={"start": "9999-12-31"}).status_code == 422


def test_a_late_meal_lands_on_the_users_own_day(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    # 23:30 UTC on 29 October is already 30 October in Tokyo (+9).
    _create(client, _meal_body(eaten_at="2026-10-29T23:30:00Z", calories=400))
    assert client.get("/api/v1/days/2026-10-29").json()["meal_count"] == 1
    assert (
        client.get("/api/v1/days/2026-10-29", params={"tz": "Asia/Tokyo"}).json()["meal_count"] == 0
    )
    assert (
        client.get("/api/v1/days/2026-10-30", params={"tz": "Asia/Tokyo"}).json()["meal_count"] == 1
    )
    week = client.get("/api/v1/week", params={"start": "2026-10-26", "tz": "Asia/Tokyo"}).json()
    assert week[4]["date"] == "2026-10-30"
    assert week[4]["meal_count"] == 1


def test_an_unknown_time_zone_is_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    assert client.get("/api/v1/days/2026-10-29", params={"tz": "Mars/Olympus"}).status_code == 422
