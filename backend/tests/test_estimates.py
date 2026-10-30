"""Text estimates: reply checks, the endpoint, and provider failures. No real provider is called."""

import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.ai.estimate import EstimateInvalid, parse_reply
from app.config import Settings
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_ai_keys import OPENAI_KEY, FakeChecker
from tests.test_auth import CSRF, FakeKeys, _callback, _start, make_id_token

GOOD = {
    "is_food": True,
    "name": "Poori, paneer butter masala",
    "calories": 760,
    "protein_g": 22,
    "carbs_g": 88,
    "fat_g": 34,
    "confidence": 0.8,
}


def _reply(**overrides: Any) -> str:
    return json.dumps({**GOOD, **overrides})


@pytest.fixture(autouse=True)
def _schema_and_clean_db() -> None:
    migrate_to_head()
    run(truncate_all)


# --- reply checks ----------------------------------------------------------------------


def test_a_good_reply_is_accepted() -> None:
    estimate = parse_reply(_reply())
    assert estimate.calories == 760
    assert estimate.name.startswith("Poori")


def test_text_around_the_json_is_ignored() -> None:
    assert parse_reply("Here you go: " + _reply() + " Hope it helps.").calories == 760


@pytest.mark.parametrize(
    "reply",
    [
        _reply(is_food=False),
        _reply(confidence=0.1),
        _reply(calories=-5),
        _reply(calories=9000),
        _reply(protein_g=999),
        _reply(calories=100),  # macros add up to about 760, not 100
        json.dumps({"is_food": True, "name": "Soup"}),  # missing numbers
        "I cannot help with that.",
        "{not json}",
    ],
)
def test_bad_replies_are_refused_not_fixed(reply: str) -> None:
    with pytest.raises(EstimateInvalid):
        parse_reply(reply)


# --- endpoint --------------------------------------------------------------------------


def _provider(handler: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    application = create_app(settings)
    application.state.jwks = FakeKeys()
    application.state.key_checker = FakeChecker()
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, follow_redirects=False) as test_client:
        yield test_client


def _sign_in(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    client.cookies.clear()
    state, nonce = _start(client)
    response = _callback(
        client, state, monkeypatch, nonce=nonce, id_token=make_id_token(nonce=nonce)
    )
    assert response.status_code == 303


def _save_openai_key(client: TestClient) -> None:
    response = client.put(
        "/api/v1/me/ai-keys/openai",
        json={"api_key": OPENAI_KEY, "acknowledge_provider_terms": True},
        headers=CSRF,
    )
    assert response.status_code == 200


def test_estimate_needs_a_saved_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in(client, monkeypatch)
    response = client.post("/api/v1/estimates", json={"text": "two eggs on toast"}, headers=CSRF)
    assert response.status_code == 409


def test_estimate_uses_the_key_in_a_header_and_returns_the_numbers(
    app: FastAPI, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = {"choices": [{"message": {"content": _reply()}}]}
        return httpx.Response(200, json=body)

    app.state.estimate_http = _provider(handler)
    _sign_in(client, monkeypatch)
    _save_openai_key(client)

    response = client.post(
        "/api/v1/estimates", json={"text": "4 poori with paneer butter masala"}, headers=CSRF
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openai"
    assert body["estimate"]["calories"] == 760
    assert body["estimate"]["protein_g"] == 22

    sent = seen[0]
    assert sent.headers["authorization"] == f"Bearer {OPENAI_KEY}"
    assert OPENAI_KEY not in str(sent.url)
    assert OPENAI_KEY.encode() not in sent.content  # the key is never in the body either


def test_provider_outage_is_reported_and_nothing_is_saved(
    app: FastAPI, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    app.state.estimate_http = _provider(lambda r: httpx.Response(500))
    _sign_in(client, monkeypatch)
    _save_openai_key(client)
    response = client.post("/api/v1/estimates", json={"text": "two eggs on toast"}, headers=CSRF)
    assert response.status_code == 503
    assert client.get("/api/v1/meals").json()["items"] == []


def test_an_unusable_reply_is_a_clear_422(
    app: FastAPI, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    app.state.estimate_http = _provider(
        lambda r: httpx.Response(200, json={"choices": [{"message": {"content": "sorry"}}]})
    )
    _sign_in(client, monkeypatch)
    _save_openai_key(client)
    response = client.post("/api/v1/estimates", json={"text": "two eggs on toast"}, headers=CSRF)
    assert response.status_code == 422
    assert response.json()["detail"]


def test_estimate_needs_the_csrf_header(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in(client, monkeypatch)
    assert client.post("/api/v1/estimates", json={"text": "two eggs"}).status_code == 403
