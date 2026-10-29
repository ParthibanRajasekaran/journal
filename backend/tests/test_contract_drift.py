"""The running app must not drift from docs/openapi.yaml.

Every exposed route must exist in the contract with the same method and
operationId, so the code can never offer an endpoint the contract does not describe.
"""

from fastapi import FastAPI

from app.main import API_PREFIX
from tests.test_contract_rules import HTTP_METHODS, OPERATIONS, SPEC


def _contract_index() -> dict[tuple[str, str], str]:
    return {(path, method): op["operationId"] for path, method, op in OPERATIONS}


def test_exposed_routes_exist_in_contract(app: FastAPI) -> None:
    contract = _contract_index()
    schema = app.openapi()
    checked = 0
    for path, item in schema["paths"].items():
        if not path.startswith(API_PREFIX):
            continue
        contract_path = path.removeprefix(API_PREFIX)
        for method, operation in item.items():
            if method not in HTTP_METHODS:
                continue
            checked += 1
            key = (contract_path, method)
            assert key in contract, f"{method.upper()} {path} is not in docs/openapi.yaml"
            assert contract[key] == operation["operationId"], (
                f"{method.upper()} {path}: code operationId {operation['operationId']!r} "
                f"differs from contract {contract[key]!r}"
            )
    assert checked > 0, "no routes were compared; the drift check would pass vacuously"


def test_contract_server_base_matches_api_prefix() -> None:
    servers = SPEC.get("servers", [])
    assert servers, "contract must declare a server"
    assert servers[0]["url"].endswith(API_PREFIX)
