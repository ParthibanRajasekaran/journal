"""Bring-your-own-key: encrypted storage, provider checks, ownership, and failure handling."""

from collections.abc import Iterator
from typing import Any, cast

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.ai.providers import Provider, ProviderKeyChecker, ProviderUnavailable, format_problem
from app.config import Settings
from app.crypto import CryptoError, decrypt, encrypt, load_key
from app.main import create_app
from tests.conftest import TEST_KEY_B64
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_auth import CSRF, FakeKeys, _callback, _start, make_id_token

OPENAI_KEY = "sk-" + "x" * 40
ANTHROPIC_KEY = "sk-ant-" + "y" * 40
GEMINI_KEY = "AIza" + "z" * 35


class FakeChecker:
    def __init__(self, valid: bool = True, unavailable: bool = False) -> None:
        self.valid = valid
        self.unavailable = unavailable
        self.calls: list[tuple[str, str]] = []

    async def is_valid(self, provider: str, api_key: str) -> bool:
        self.calls.append((provider, api_key))
        if self.unavailable:
            raise ProviderUnavailable("down")
        return self.valid


@pytest.fixture(autouse=True)
def _schema_and_clean_db() -> None:
    migrate_to_head()
    run(truncate_all)


@pytest.fixture
def checker() -> FakeChecker:
    return FakeChecker()


@pytest.fixture
def app(settings: Settings, checker: FakeChecker) -> FastAPI:
    application = create_app(settings)
    application.state.jwks = FakeKeys()
    application.state.key_checker = checker
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


def _save(client: TestClient, provider: str, key: str, acknowledge: bool = True) -> Any:
    return client.put(
        f"/api/v1/me/ai-keys/{provider}",
        json={"api_key": key, "acknowledge_provider_terms": acknowledge},
        headers=CSRF,
    )


# --- storage ---------------------------------------------------------------------------


def test_saved_key_is_returned_only_as_its_last_four_characters(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    response = _save(client, "openai", OPENAI_KEY)
    assert response.status_code == 200
    assert response.json()["last4"] == OPENAI_KEY[-4:]
    assert OPENAI_KEY not in response.text

    listing = client.get("/api/v1/me/ai-keys")
    assert listing.status_code == 200
    assert OPENAI_KEY not in listing.text
    assert listing.json()[0]["provider"] == "openai"


def test_the_database_holds_only_ciphertext(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _save(client, "openai", OPENAI_KEY)

    async def raw(engine: AsyncEngine) -> bytes:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT ciphertext FROM ai_keys"))
            return bytes(result.scalar_one())

    blob = run(raw)
    assert OPENAI_KEY.encode() not in blob
    assert blob.startswith(b"v1")


def test_saving_again_replaces_the_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _save(client, "openai", OPENAI_KEY)
    replacement = "sk-" + "q" * 40
    assert _save(client, "openai", replacement).status_code == 200
    listing = client.get("/api/v1/me/ai-keys").json()
    assert len(listing) == 1
    assert listing[0]["last4"] == replacement[-4:]


def test_delete_removes_the_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _save(client, "anthropic", ANTHROPIC_KEY)
    assert client.delete("/api/v1/me/ai-keys/anthropic", headers=CSRF).status_code == 204
    assert client.get("/api/v1/me/ai-keys").json() == []
    assert client.delete("/api/v1/me/ai-keys/anthropic", headers=CSRF).status_code == 404


# --- checks before storing -------------------------------------------------------------


def test_a_key_for_the_wrong_provider_is_refused_before_any_call(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, checker: FakeChecker
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    assert _save(client, "anthropic", OPENAI_KEY).status_code == 422
    assert checker.calls == []


def test_a_key_the_provider_rejects_is_not_stored(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, checker: FakeChecker
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    checker.valid = False
    assert _save(client, "openai", OPENAI_KEY).status_code == 422
    assert client.get("/api/v1/me/ai-keys").json() == []


def test_provider_outage_does_not_store_anything(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, checker: FakeChecker
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    checker.unavailable = True
    response = _save(client, "openai", OPENAI_KEY)
    assert response.status_code == 503
    assert client.get("/api/v1/me/ai-keys").json() == []


def test_the_user_must_acknowledge_the_provider_terms(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, checker: FakeChecker
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    assert _save(client, "openai", OPENAI_KEY, acknowledge=False).status_code == 422
    assert checker.calls == []


def test_saving_without_the_csrf_header_is_refused(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    response = client.put(
        "/api/v1/me/ai-keys/openai",
        json={"api_key": OPENAI_KEY, "acknowledge_provider_terms": True},
    )
    assert response.status_code == 403


def test_missing_encryption_key_refuses_to_store(
    settings: Settings, monkeypatch: pytest.MonkeyPatch, checker: FakeChecker
) -> None:
    unconfigured = Settings(
        environment="test",
        database_url=settings.database_url,
        jwt_secret=settings.jwt_secret,
        google_client_id=settings.google_client_id,
        google_client_secret=settings.google_client_secret,
        cookie_secure=False,
    )
    application = create_app(unconfigured)
    application.state.jwks = FakeKeys()
    application.state.key_checker = checker
    with TestClient(application, follow_redirects=False) as client:
        _sign_in_as(client, monkeypatch, "owner-a")
        assert _save(client, "openai", OPENAI_KEY).status_code == 503
    assert checker.calls == []


# --- ownership -------------------------------------------------------------------------


def test_another_user_cannot_see_or_delete_a_saved_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sign_in_as(client, monkeypatch, "owner-a")
    _save(client, "gemini", GEMINI_KEY)

    _sign_in_as(client, monkeypatch, "someone-else")
    assert client.get("/api/v1/me/ai-keys").json() == []
    assert client.delete("/api/v1/me/ai-keys/gemini", headers=CSRF).status_code == 404

    _sign_in_as(client, monkeypatch, "owner-a")
    assert len(client.get("/api/v1/me/ai-keys").json()) == 1


# --- encryption unit tests -------------------------------------------------------------


def test_ciphertext_only_opens_for_its_owner_and_provider() -> None:
    key = load_key(SecretStr(TEST_KEY_B64))
    blob = encrypt(key, OPENAI_KEY, "usr_a", "openai")
    assert decrypt(key, blob, "usr_a", "openai") == OPENAI_KEY
    with pytest.raises(CryptoError):
        decrypt(key, blob, "usr_b", "openai")
    with pytest.raises(CryptoError):
        decrypt(key, blob, "usr_a", "gemini")


def test_tampered_ciphertext_is_detected() -> None:
    key = load_key(SecretStr(TEST_KEY_B64))
    blob = bytearray(encrypt(key, OPENAI_KEY, "usr_a", "openai"))
    blob[-1] ^= 0x01
    with pytest.raises(CryptoError):
        decrypt(key, bytes(blob), "usr_a", "openai")


def test_key_must_be_32_bytes() -> None:
    with pytest.raises(CryptoError):
        load_key(SecretStr("c2hvcnQ="))


# --- provider checks over a mock transport ---------------------------------------------


def _checker_with(handler: Any) -> ProviderKeyChecker:
    return ProviderKeyChecker(httpx.AsyncClient(transport=httpx.MockTransport(handler)))


@pytest.mark.parametrize(
    ("provider", "key", "header", "expected"),
    [
        ("openai", OPENAI_KEY, "authorization", f"Bearer {OPENAI_KEY}"),
        ("anthropic", ANTHROPIC_KEY, "x-api-key", ANTHROPIC_KEY),
        ("gemini", GEMINI_KEY, "x-goog-api-key", GEMINI_KEY),
    ],
)
def test_each_provider_gets_the_key_in_a_header_not_the_url(
    provider: str, key: str, header: str, expected: str
) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"data": []})

    import asyncio

    assert asyncio.run(_checker_with(handler).is_valid(cast(Provider, provider), key)) is True
    request = seen[0]
    assert request.headers[header] == expected
    assert key not in str(request.url)


def test_provider_401_means_rejected_and_5xx_means_unavailable() -> None:
    import asyncio

    rejected = _checker_with(lambda r: httpx.Response(401))
    assert asyncio.run(rejected.is_valid("openai", OPENAI_KEY)) is False
    broken = _checker_with(lambda r: httpx.Response(500))
    with pytest.raises(ProviderUnavailable):
        asyncio.run(broken.is_valid("openai", OPENAI_KEY))


def test_network_failure_means_unavailable_not_rejected() -> None:
    import asyncio

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no route", request=request)

    with pytest.raises(ProviderUnavailable):
        asyncio.run(_checker_with(handler).is_valid("openai", OPENAI_KEY))


def test_format_checks_catch_wrong_pastes() -> None:
    assert format_problem("openai", OPENAI_KEY) is None
    assert format_problem("anthropic", ANTHROPIC_KEY) is None
    assert format_problem("gemini", GEMINI_KEY) is None
    assert format_problem("openai", ANTHROPIC_KEY) is not None
    assert format_problem("gemini", OPENAI_KEY) is not None
    assert format_problem("openai", OPENAI_KEY + " ") is not None
