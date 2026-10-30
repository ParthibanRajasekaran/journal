"""Text estimates: item totals, questions and defaults, endpoint behaviour.

No real provider is called.
"""

import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.ai.estimate import Estimate, EstimateInvalid, Pending, SuppliedAnswer, parse_reply
from app.config import Settings
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_ai_keys import OPENAI_KEY, FakeChecker
from tests.test_auth import CSRF, FakeKeys, _callback, _start, make_id_token

POORI = {"name": "Poori (4)", "calories": 500, "protein_g": 14, "carbs_g": 60, "fat_g": 26}
CURRY = {
    "name": "Paneer butter masala (5 spoons)",
    "calories": 260,
    "protein_g": 8,
    "carbs_g": 28,
    "fat_g": 8,
}
FLOUR_QUESTION: dict[str, Any] = {
    "id": "flour",
    "question": "Were the pooris made with wheat or maida?",
    "options": ["wheat", "maida"],
    "default": "wheat",
}


def _reply(items: list[dict[str, Any]] | None = None, **overrides: Any) -> str:
    body: dict[str, Any] = {
        "is_food": True,
        "name": "Poori with paneer butter masala",
        "items": items if items is not None else [POORI, CURRY],
        "questions": [],
        "confidence": 0.8,
    }
    body.update(overrides)
    return json.dumps(body)


def _supplied(answer: str) -> list[SuppliedAnswer]:
    return [SuppliedAnswer(**{**FLOUR_QUESTION, "answer": answer})]


@pytest.fixture(autouse=True)
def _schema_and_clean_db() -> None:
    migrate_to_head()
    run(truncate_all)


# --- reply checks ----------------------------------------------------------------------


def test_totals_are_the_sum_of_the_items() -> None:
    estimate = parse_reply(_reply())
    assert isinstance(estimate, Estimate)
    assert estimate.calories == 760
    assert estimate.protein_g == 22
    assert len(estimate.items) == 2


def test_questions_are_returned_when_nothing_is_supplied() -> None:
    result = parse_reply(_reply(questions=[FLOUR_QUESTION]))
    assert isinstance(result, Pending)
    assert result.questions[0].id == "flour"


def test_unsure_takes_the_default_and_says_so() -> None:
    result = parse_reply(_reply(questions=[FLOUR_QUESTION]), supplied=_supplied("unsure"))
    assert isinstance(result, Estimate)
    assert result.assumptions == ["Were the pooris made with wheat or maida: assumed wheat"]


def test_a_real_answer_is_used_without_an_assumption() -> None:
    result = parse_reply(_reply(questions=[FLOUR_QUESTION]), supplied=_supplied("maida"))
    assert isinstance(result, Estimate)
    assert result.assumptions == []


def test_an_answer_outside_the_options_counts_as_unsure() -> None:
    result = parse_reply(_reply(questions=[FLOUR_QUESTION]), supplied=_supplied("rye"))
    assert isinstance(result, Estimate)
    assert len(result.assumptions) == 1


@pytest.mark.parametrize(
    "reply",
    [
        _reply(is_food=False),
        _reply(confidence=0.1),
        _reply(items=[{**POORI, "calories": -5}]),
        _reply(items=[{**POORI, "calories": 9000}]),
        _reply(items=[{**POORI, "protein_g": 999}]),
        _reply(
            items=[{"name": "Soup", "calories": 100, "protein_g": 60, "carbs_g": 0, "fat_g": 0}]
        ),
        json.dumps({"is_food": True, "name": "Soup"}),
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


def _openai_reply(content: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


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


def test_the_key_is_sent_in_a_header_and_the_items_come_back(
    app: FastAPI, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _openai_reply(_reply())

    app.state.estimate_http = _provider(handler)
    _sign_in(client, monkeypatch)
    _save_openai_key(client)

    response = client.post(
        "/api/v1/estimates", json={"text": "4 poori with paneer butter masala"}, headers=CSRF
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "estimate"
    assert body["estimate"]["calories"] == 760
    assert [item["name"] for item in body["estimate"]["items"]] == [
        "Poori (4)",
        "Paneer butter masala (5 spoons)",
    ]

    sent = seen[0]
    assert sent.headers["authorization"] == f"Bearer {OPENAI_KEY}"
    assert OPENAI_KEY not in str(sent.url)
    assert OPENAI_KEY.encode() not in sent.content


def test_a_question_comes_back_then_the_answer_is_used(
    app: FastAPI, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        calls.append(body["messages"][1]["content"])
        if "Details from the user" in body["messages"][1]["content"]:
            return _openai_reply(_reply())
        return _openai_reply(_reply(questions=[FLOUR_QUESTION]))

    app.state.estimate_http = _provider(handler)
    _sign_in(client, monkeypatch)
    _save_openai_key(client)

    first = client.post("/api/v1/estimates", json={"text": "4 poori"}, headers=CSRF).json()
    assert first["status"] == "needs_answers"
    assert first["questions"][0]["options"] == ["wheat", "maida"]

    second = client.post(
        "/api/v1/estimates",
        json={"text": "4 poori", "answers": [{**FLOUR_QUESTION, "answer": "unsure"}]},
        headers=CSRF,
    ).json()
    assert second["status"] == "estimate"
    assert second["estimate"]["assumptions"] == [
        "Were the pooris made with wheat or maida: assumed wheat"
    ]
    assert "use the default: wheat" in calls[-1]


def test_at_most_two_rounds_are_made(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in(client, monkeypatch)
    too_many = [{**FLOUR_QUESTION, "id": f"q{i}", "answer": "wheat"} for i in range(3)]
    response = client.post(
        "/api/v1/estimates", json={"text": "4 poori", "answers": too_many}, headers=CSRF
    )
    assert response.status_code == 422


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
    app.state.estimate_http = _provider(lambda r: _openai_reply("sorry"))
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
