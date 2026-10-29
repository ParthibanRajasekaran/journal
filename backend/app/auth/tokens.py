"""Journal's own tokens. Signed with HS256 and a strict algorithm allowlist.

Refresh tokens are opaque random strings. Only their SHA-256 hash is stored.
"""

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pydantic import SecretStr

ISSUER = "journal-api"
ALGORITHM = "HS256"
ACCESS_TYPE = "access"
STATE_TYPE = "oauth_state"
MIN_SECRET_LENGTH = 32


class AuthError(Exception):
    """Raised for any token that must not be accepted."""


def signing_key(secret: SecretStr | None) -> str:
    if secret is None or len(secret.get_secret_value()) < MIN_SECRET_LENGTH:
        raise RuntimeError(
            f"JOURNAL_JWT_SECRET must be set to at least {MIN_SECRET_LENGTH} characters"
        )
    return secret.get_secret_value()


def _encode(claims: dict[str, Any], key: str) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {"iss": ISSUER, "iat": now, **claims},
        key,
        algorithm=ALGORITHM,
    )


def _decode(token: str, key: str) -> dict[str, Any]:
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            key,
            algorithms=[ALGORITHM],
            issuer=ISSUER,
            options={"require": ["exp", "iat", "iss"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthError("invalid token") from exc
    return claims


def issue_access_token(user_id: str, key: str, ttl_seconds: int) -> str:
    now = datetime.now(UTC)
    return _encode(
        {"sub": user_id, "typ": ACCESS_TYPE, "exp": now + timedelta(seconds=ttl_seconds)},
        key,
    )


def user_id_from_access_token(token: str, key: str) -> str:
    claims = _decode(token, key)
    if claims.get("typ") != ACCESS_TYPE or not isinstance(claims.get("sub"), str):
        raise AuthError("not an access token")
    return str(claims["sub"])


def issue_state_token(state: str, nonce: str, verifier: str, key: str, ttl_seconds: int) -> str:
    now = datetime.now(UTC)
    return _encode(
        {
            "typ": STATE_TYPE,
            "state": state,
            "nonce": nonce,
            "verifier": verifier,
            "exp": now + timedelta(seconds=ttl_seconds),
        },
        key,
    )


def read_state_token(token: str, key: str) -> dict[str, str]:
    claims = _decode(token, key)
    if claims.get("typ") != STATE_TYPE:
        raise AuthError("not a sign-in state token")
    return {name: str(claims[name]) for name in ("state", "nonce", "verifier")}


def new_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
