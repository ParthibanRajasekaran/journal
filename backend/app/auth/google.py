"""Google OpenID Connect: authorization URL, code exchange, and ID token checks."""

import secrets
from typing import Any, Protocol
from urllib.parse import urlencode

import httpx
import jwt

from app.auth.tokens import AuthError

AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
CODE_EXCHANGE_ENDPOINT = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("https://accounts.google.com", "accounts.google.com")
SCOPES = "openid email profile"
CLOCK_LEEWAY_SECONDS = 60


class SigningKeySource(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> Any: ...


def authorization_url(
    client_id: str, redirect_uri: str, state: str, nonce: str, challenge: str
) -> str:
    query = urlencode(
        {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": SCOPES,
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "prompt": "select_account",
        }
    )
    return f"{AUTHORIZATION_URL}?{query}"


async def exchange_code(
    http: httpx.AsyncClient,
    *,
    code: str,
    verifier: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
) -> str:
    """Trade the authorization code for an ID token. The client secret never leaves the server."""
    response = await http.post(
        CODE_EXCHANGE_ENDPOINT,
        data={
            "code": code,
            "code_verifier": verifier,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    if response.status_code != 200:
        raise AuthError("token exchange rejected")
    id_token = response.json().get("id_token")
    if not isinstance(id_token, str):
        raise AuthError("no ID token returned")
    return id_token


def verify_id_token(
    id_token: str, *, client_id: str, expected_nonce: str, keys: SigningKeySource
) -> dict[str, Any]:
    """Check signature, issuer, audience, expiry, nonce, and that the email is verified."""
    try:
        key = keys.get_signing_key_from_jwt(id_token).key
        claims: dict[str, Any] = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=list(ISSUERS),
            leeway=CLOCK_LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthError("ID token rejected") from exc

    if claims.get("azp", client_id) != client_id:
        raise AuthError("ID token issued to another client")
    if not secrets.compare_digest(str(claims["nonce"]), expected_nonce):
        raise AuthError("nonce mismatch")
    if claims.get("email_verified") is not True:
        raise AuthError("email not verified")
    return claims
