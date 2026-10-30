"""AES-256-GCM for stored provider keys.

Each ciphertext is bound to its owner and provider through the associated data, so a
row copied to another user or provider will not decrypt. The format is b"v1" + nonce + ciphertext.
"""

import base64
import binascii
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pydantic import SecretStr

VERSION = b"v1"


class CryptoError(Exception):
    pass


def load_key(secret: SecretStr | None) -> bytes:
    if secret is None:
        raise CryptoError("JOURNAL_KEY_ENCRYPTION_KEY is not set")
    try:
        key = base64.b64decode(secret.get_secret_value(), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise CryptoError("JOURNAL_KEY_ENCRYPTION_KEY is not valid base64") from exc
    if len(key) != 32:
        raise CryptoError("JOURNAL_KEY_ENCRYPTION_KEY must decode to 32 bytes")
    return key


def _aad(user_id: str, provider: str) -> bytes:
    return f"{user_id}|{provider}".encode()


def encrypt(key: bytes, plaintext: str, user_id: str, provider: str) -> bytes:
    nonce = os.urandom(12)
    body = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), _aad(user_id, provider))
    return VERSION + nonce + body


def decrypt(key: bytes, blob: bytes, user_id: str, provider: str) -> str:
    if not blob.startswith(VERSION):
        raise CryptoError("unknown ciphertext version")
    nonce, body = blob[2:14], blob[14:]
    try:
        return AESGCM(key).decrypt(nonce, body, _aad(user_id, provider)).decode("utf-8")
    except InvalidTag as exc:
        raise CryptoError("ciphertext does not match this owner or provider") from exc
