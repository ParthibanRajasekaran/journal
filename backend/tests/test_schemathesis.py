"""Property-based conformance against the reviewed contract (docs/openapi.yaml).

Schemathesis loads the contract file itself, generates requests (including
malformed ones), sends them to the real app, and checks every response against
the contract's declared status codes and schemas. Only operations the app
implements are exercised; drift in either direction is caught by the drift tests.
"""

from pathlib import Path
from typing import Any

import schemathesis
import yaml
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from hypothesis import settings
from schemathesis.openapi import from_asgi

from app.config import Settings
from app.main import create_app

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def _contract_host(real_app: FastAPI) -> FastAPI:
    """Serve the contract file from a wrapper app; the real app handles all API calls."""
    contract: dict[str, Any] = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    host = FastAPI()

    @host.get("/_contract.json", include_in_schema=False)
    async def contract_document() -> JSONResponse:
        return JSONResponse(contract)

    host.mount("/", real_app)
    return host


def _implemented_operation_ids(real_app: FastAPI) -> list[str]:
    ids: list[str] = []
    for item in real_app.openapi()["paths"].values():
        for method, operation in item.items():
            if method in HTTP_METHODS:
                ids.append(operation["operationId"])
    return ids


_real_app = create_app(Settings(environment="test"))
_host = _contract_host(_real_app)
schema = from_asgi("/_contract.json", _host).include(
    operation_id=_implemented_operation_ids(_real_app)
)


@schema.parametrize()
@settings(max_examples=50, deadline=None)
def test_implemented_operations_conform_to_contract(case: schemathesis.Case[Any]) -> None:
    case.call_and_validate()
