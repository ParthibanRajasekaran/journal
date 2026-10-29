from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.errors import PROBLEM_MEDIA_TYPE


class _Probe(BaseModel):
    calories: int


def _add_probe(app: FastAPI) -> None:
    @app.post("/api/v1/_probe")
    async def probe(body: _Probe) -> dict[str, int]:
        return {"calories": body.calories}


def test_unknown_route_returns_problem_json(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith(PROBLEM_MEDIA_TYPE)
    body = response.json()
    assert body["status"] == 404
    assert body["type"] == "https://journal.example/problems/not-found"
    assert body["instance"] == "/api/v1/does-not-exist"


def test_wrong_method_returns_problem_json(client: TestClient) -> None:
    response = client.delete("/api/v1/health")
    assert response.status_code == 405
    assert response.headers["content-type"].startswith(PROBLEM_MEDIA_TYPE)
    assert response.json()["type"].endswith("/method-not-allowed")


def test_validation_error_lists_fields(app: FastAPI, client: TestClient) -> None:
    _add_probe(app)
    response = client.post("/api/v1/_probe", json={"calories": "lots"})
    assert response.status_code == 422
    assert response.headers["content-type"].startswith(PROBLEM_MEDIA_TYPE)
    body = response.json()
    assert body["type"].endswith("/validation-failed")
    assert body["errors"][0]["field"] == "body.calories"
    assert body["errors"][0]["message"]


def test_error_body_never_echoes_request_body(app: FastAPI, client: TestClient) -> None:
    _add_probe(app)
    response = client.post("/api/v1/_probe", json={"calories": "sensitive-meal-text"})
    assert "sensitive-meal-text" not in response.text
