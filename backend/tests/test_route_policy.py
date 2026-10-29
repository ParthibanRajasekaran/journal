"""Every exposed API route must be either public or explicitly protected.

Routes are read from the app's generated OpenAPI document, because FastAPI 0.162 nests
included routers. Protected routes are listed explicitly, and a test sends each one an
anonymous request and expects a refusal. Adding a route therefore forces a reviewed
decision: public (listed in the contract's public set) or protected (listed here).
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import API_PREFIX
from tests.test_contract_rules import PUBLIC_OPERATIONS

PUBLIC_API_ROUTES = {(f"{API_PREFIX}{path}", method) for path, method in PUBLIC_OPERATIONS}
PROTECTED_API_ROUTES = {
    (f"{API_PREFIX}/me", "get"),
    (f"{API_PREFIX}/auth/logout", "post"),
}
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def exposed_api_routes(app: FastAPI) -> set[tuple[str, str]]:
    schema = app.openapi()
    found: set[tuple[str, str]] = set()
    for path, item in schema["paths"].items():
        if not path.startswith(API_PREFIX):
            continue
        for method in item:
            if method in HTTP_METHODS:
                found.add((path, method))
    return found


def test_routes_are_discovered(app: FastAPI) -> None:
    assert exposed_api_routes(app), "no API routes discovered"


def test_every_route_is_public_or_declared_protected(app: FastAPI) -> None:
    unexpected = exposed_api_routes(app) - PUBLIC_API_ROUTES - PROTECTED_API_ROUTES
    assert unexpected == set(), (
        f"routes missing a public or protected decision: {sorted(unexpected)}"
    )


def test_protected_routes_are_all_exposed(app: FastAPI) -> None:
    assert exposed_api_routes(app) >= PROTECTED_API_ROUTES


@pytest.mark.parametrize(("path", "method"), sorted(PROTECTED_API_ROUTES))
def test_protected_route_refuses_anonymous_callers(
    client: TestClient, path: str, method: str
) -> None:
    headers = {"X-Journal-Request": "1"}
    response = client.request(method.upper(), path, headers=headers)
    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")
