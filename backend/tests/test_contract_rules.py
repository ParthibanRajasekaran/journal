"""Gate tests for the API contract (docs/openapi.yaml).

These run before any API code exists. They enforce rules from the PRD and ADR-001:
- every operation requires authentication unless it is explicitly public;
- the public list is fixed here, so adding a public route needs a reviewed change;
- every operation has a unique operationId;
- every error response uses the RFC 9457 problem media type.
"""

from pathlib import Path
from typing import Any

import pytest
import yaml

SPEC_PATH = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}

# The only operations allowed without a bearer token (ADR-001 "Auth and limits").
PUBLIC_OPERATIONS = {
    ("/auth/google/start", "get"),
    ("/auth/google/callback", "get"),
    ("/auth/refresh", "post"),
    ("/health", "get"),
    ("/health/ready", "get"),
}


def _load_spec() -> dict[str, Any]:
    with SPEC_PATH.open(encoding="utf-8") as handle:
        loaded: dict[str, Any] = yaml.safe_load(handle)
    return loaded


def _operations(spec: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    found: list[tuple[str, str, dict[str, Any]]] = []
    for path, item in spec["paths"].items():
        for method, operation in item.items():
            if method in HTTP_METHODS:
                found.append((path, method, operation))
    return found


def _resolve(spec: dict[str, Any], ref: str) -> dict[str, Any]:
    node: Any = spec
    for part in ref.removeprefix("#/").split("/"):
        node = node[part]
    return dict(node)


SPEC = _load_spec()
OPERATIONS = _operations(SPEC)


def test_spec_accepts_bearer_or_session_cookie() -> None:
    assert SPEC.get("security") == [{"bearerAuth": []}, {"cookieAuth": []}]


def test_spec_has_operations() -> None:
    assert len(OPERATIONS) >= 20


@pytest.mark.parametrize(("path", "method", "operation"), OPERATIONS)
def test_operation_auth_matches_public_allowlist(
    path: str, method: str, operation: dict[str, Any]
) -> None:
    is_public = (path, method) in PUBLIC_OPERATIONS
    declares_public = operation.get("security") == []
    if is_public:
        assert declares_public, f"{method.upper()} {path} must declare security: []"
    else:
        assert "security" not in operation or operation["security"] != [], (
            f"{method.upper()} {path} must require authentication"
        )


def test_public_allowlist_matches_spec() -> None:
    declared_public = {
        (path, method) for path, method, operation in OPERATIONS if operation.get("security") == []
    }
    assert declared_public == PUBLIC_OPERATIONS


@pytest.mark.parametrize(("path", "method", "operation"), OPERATIONS)
def test_operation_has_operation_id(path: str, method: str, operation: dict[str, Any]) -> None:
    assert operation.get("operationId"), f"{method.upper()} {path} needs operationId"


def test_operation_ids_are_unique() -> None:
    ids = [operation["operationId"] for _, _, operation in OPERATIONS]
    assert len(ids) == len(set(ids)), "duplicate operationId"


@pytest.mark.parametrize(("path", "method", "operation"), OPERATIONS)
def test_error_responses_use_problem_json(
    path: str, method: str, operation: dict[str, Any]
) -> None:
    for status, response in operation.get("responses", {}).items():
        if not str(status).startswith(("4", "5")):
            continue
        if "$ref" in response:
            response = _resolve(SPEC, response["$ref"])
        content = response.get("content", {})
        assert "application/problem+json" in content, (
            f"{method.upper()} {path} {status} must return application/problem+json"
        )
