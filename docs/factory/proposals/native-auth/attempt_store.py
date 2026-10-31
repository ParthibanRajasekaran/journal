"""Reference model for native sign-in attempts (PROPOSAL, not wired into the application).

Correlation design:
- POST /native/attempts creates an attempt. The server returns two values: `attempt_secret`, which only the
  initiating client keeps (in secure storage, never sent to Google), and `nonce`, which the client passes to the
  Google SDK as GoogleLoginOptions.nonce. The server stores only sha256 of each.
- POST /native/attempts/{attempt_secret}/complete with {id_token}. The server finds the pending attempt by the
  hash of the secret. It never looks an attempt up by the nonce inside the token. The token's nonce claim must
  equal that attempt's nonce, and the attempt must be pending and unexpired.
- The attempt is consumed with one UPDATE that succeeds for exactly one caller. Verification happens before
  consumption, so a token that does not match this attempt does not burn it.
- Cancellation marks the attempt cancelled. Failure leaves it pending until it expires. A retry needs a new attempt.

The account ID is never an input. Nothing in the token is treated as proof of which attempt it belongs to.
Token signature, audience and issuer checks are performed by the real verifier, and are outside this model.
"""

from __future__ import annotations

import hashlib
import secrets
import sqlite3
import time
from dataclasses import dataclass
from typing import Callable

TTL_SECONDS = 300


class Refused(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Claims:
    """The fields the nonce binding needs. Signature and audience checks happen in the real verifier."""

    nonce: str | None
    subject: str


class AttemptStore:
    def __init__(self, path: str, clock: Callable[[], float] = time.time, ttl: int = TTL_SECONDS):
        self._conn = sqlite3.connect(path, isolation_level=None, check_same_thread=False, timeout=30)
        self._clock = clock
        self._ttl = ttl
        self._conn.executescript(
            """
            create table if not exists attempts (
              attempt_hash text primary key,
              nonce_hash text not null,
              state text not null check (state in ('pending', 'consumed', 'cancelled')),
              expires_at real not null,
              created_at real not null
            );
            """
        )

    def create(self) -> dict:
        secret, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        now = self._clock()
        self._conn.execute(
            "insert into attempts (attempt_hash, nonce_hash, state, expires_at, created_at) values (?, ?, 'pending', ?, ?)",
            (digest(secret), digest(nonce), now + self._ttl, now),
        )
        return {"attempt_secret": secret, "nonce": nonce, "expires_in": self._ttl}

    def cancel(self, attempt_secret: str) -> None:
        """Idempotent. Cancelling a finished attempt changes nothing."""
        self._conn.execute(
            "update attempts set state = 'cancelled' where attempt_hash = ? and state = 'pending'",
            (digest(attempt_secret),),
        )

    def complete(self, attempt_secret: str, token: Claims) -> str:
        """Returns the subject on success. Raises Refused otherwise."""
        row = self._conn.execute(
            "select nonce_hash, state, expires_at from attempts where attempt_hash = ?",
            (digest(attempt_secret),),
        ).fetchone()
        if row is None:
            raise Refused("unknown attempt")
        nonce_hash, state, expires_at = row
        if state != "pending":
            raise Refused(f"attempt is {state}")
        if expires_at <= self._clock():
            raise Refused("attempt expired")
        if token.nonce is None:
            raise Refused("token has no nonce; a restored sign-in cannot complete an attempt")
        if digest(token.nonce) != nonce_hash:
            raise Refused("token nonce does not belong to this attempt")
        # Atomic consumption: exactly one concurrent caller changes the row from pending to consumed.
        cur = self._conn.execute(
            "update attempts set state = 'consumed' where attempt_hash = ? and state = 'pending' and expires_at > ?",
            (digest(attempt_secret), self._clock()),
        )
        if cur.rowcount != 1:
            raise Refused("attempt was consumed or expired by another request")
        return token.subject

    def state_of(self, attempt_secret: str) -> str | None:
        row = self._conn.execute("select state from attempts where attempt_hash = ?", (digest(attempt_secret),)).fetchone()
        return None if row is None else row[0]
