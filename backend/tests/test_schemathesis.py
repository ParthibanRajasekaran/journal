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
from pydantic import SecretStr
from schemathesis.openapi import from_asgi

from app.config import Settings
from app.errors import install_problem_handlers
from app.main import create_app

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def _contract_host(real_app: FastAPI) -> FastAPI:
    """Serve the contract file from a wrapper app; the real app handles all API calls."""
    contract: dict[str, Any] = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    host = FastAPI()
    # The wrapper answers requests our app never sees (odd path encodings), so it needs the same
    # error format the app uses. Production has no wrapper: Caddy forwards straight to the app.
    host.state.settings = real_app.state.settings
    install_problem_handlers(host)

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


_real_app = create_app(
    Settings(
        environment="test",
        jwt_secret=SecretStr("test-secret-that-is-at-least-32-characters-long"),
        google_client_id="test-client.apps.googleusercontent.com",
        google_client_secret=SecretStr("test-client-secret"),
    )
)
from tests.conftest import TEST_KEY_B64  # noqa: E402
from tests.test_ai_keys import FakeChecker  # noqa: E402

_real_app.state.key_checker = FakeChecker()  # never call real providers from generated tests
_real_app.state.settings.key_encryption_key = SecretStr(TEST_KEY_B64)
_host = _contract_host(_real_app)
schema = from_asgi("/_contract.json", _host).include(
    operation_id=_implemented_operation_ids(_real_app)
)


# AllowHeaderMismatch is skipped on purpose: the contract documents PATCH and DELETE on
# /me, which are not built yet, so the Allow header on /me legitimately lists only GET.
# Remove this exclusion when those methods are implemented.
@schema.parametrize()
@settings(max_examples=50, deadline=None)
def test_implemented_operations_conform_to_contract(case: schemathesis.Case[Any]) -> None:
    excluded: list[Any] = [schemathesis.checks.allow_header_conformance]
    # The callback needs the sign-in state cookie. A schema cannot express that, so random
    # but schema-valid input is correctly refused with 400. Positive acceptance is not
    # meaningful for this one operation; its failure paths are covered by unit tests.
    if case.operation.path.endswith("/auth/google/callback"):
        excluded.append(schemathesis.checks.positive_data_acceptance)
    case.call_and_validate(excluded_checks=excluded)
