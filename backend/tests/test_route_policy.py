"""Every exposed API route must be on the public allowlist until authentication exists.

Routes are read from the app's generated OpenAPI document, not from app.routes:
FastAPI 0.162 nests included routers, so app.routes does not list them flat.
This guards the rule that new routes are private by default. Once auth is added
(step 3), protected routes will be checked for the auth dependency.
"""

from fastapi import FastAPI

from app.main import API_PREFIX
from tests.test_contract_rules import PUBLIC_OPERATIONS

PUBLIC_API_ROUTES = {(f"{API_PREFIX}{path}", method) for path, method in PUBLIC_OPERATIONS}
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
    # Guards against the check passing vacuously if discovery breaks.
    assert exposed_api_routes(app), "no API routes discovered"


def test_every_api_route_is_public_or_protected(app: FastAPI) -> None:
    unexpected = exposed_api_routes(app) - PUBLIC_API_ROUTES
    # No protected routes exist yet; any new entry here must be a deliberate, reviewed addition.
    assert unexpected == set(), f"routes missing from public allowlist: {sorted(unexpected)}"


def test_public_health_route_is_exposed(app: FastAPI) -> None:
    assert ("/api/v1/health", "get") in exposed_api_routes(app)
