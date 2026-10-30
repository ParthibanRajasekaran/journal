"""Provider key formats and the one-request check that a key works.

The check makes a single cheap, read-only call (listing models) to the provider.
A key that the provider rejects is never stored. The key travels in a header, never in a URL.
"""

from typing import Literal, Protocol

import httpx

Provider = Literal["openai", "anthropic", "gemini"]
PROVIDERS: tuple[Provider, ...] = ("openai", "anthropic", "gemini")

_LIST_MODELS: dict[Provider, str] = {
    "openai": "https://api.openai.com/v1/models",
    "anthropic": "https://api.anthropic.com/v1/models",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/models",
}


class ProviderUnavailable(Exception):
    """The provider could not be reached or answered with a server-side problem."""


def format_problem(provider: Provider, api_key: str) -> str | None:
    """Return a message when the key cannot belong to this provider, otherwise None."""
    if any(ch.isspace() for ch in api_key):
        return "The key must not contain spaces."
    if provider == "anthropic" and not api_key.startswith("sk-ant-"):
        return "An Anthropic key starts with sk-ant-."
    if provider == "openai" and (not api_key.startswith("sk-") or api_key.startswith("sk-ant-")):
        return "An OpenAI key starts with sk-."
    if provider == "gemini" and not api_key.startswith("AIza"):
        return "A Gemini key starts with AIza."
    return None


class KeyChecker(Protocol):
    async def is_valid(self, provider: Provider, api_key: str) -> bool: ...


class ProviderKeyChecker:
    def __init__(self, http: httpx.AsyncClient) -> None:
        self._http = http

    async def is_valid(self, provider: Provider, api_key: str) -> bool:
        headers = _headers(provider, api_key)
        try:
            response = await self._http.get(_LIST_MODELS[provider], headers=headers, timeout=10)
        except httpx.HTTPError as exc:
            raise ProviderUnavailable("provider unreachable") from exc
        if response.status_code == 200:
            return True
        if response.status_code in (401, 403):
            return False
        raise ProviderUnavailable(f"provider answered {response.status_code}")


def _headers(provider: Provider, api_key: str) -> dict[str, str]:
    if provider == "openai":
        return {"Authorization": f"Bearer {api_key}"}
    if provider == "anthropic":
        return {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    return {"x-goog-api-key": api_key}
